const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class DependabotService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  getOwnerLogin(repo) {
    if (repo.owner && repo.owner.login) return repo.owner.login;
    if (repo.full_name) return repo.full_name.split('/')[0];
    return null;
  }

  async getDependabotDataForRepo(repo) {
    try {
      const ownerLogin = this.getOwnerLogin(repo);
      if (!ownerLogin || !repo.name) {
        console.log(`🔍 Dependabot: skip repo ${repo.name} (no owner/name)`);
        return 0;
      }

      const dependabotCacheKey = this.cacheManager.getCacheKey(repo.name, 'dependabot_critical');
      let dependabotCriticalCount = await this.cacheManager.get(dependabotCacheKey);
      
      if (dependabotCriticalCount === null) {
        console.log(`🔄 Dependabot: haetaan ilmoitukset reposta ${repo.name}...`);
        const requestKey = `dependabot_${ownerLogin}_${repo.name}`;
        dependabotCriticalCount = await this.cacheManager.deduplicateRequest(requestKey, async () => {
          try {
            let totalCritical = 0;
            let page = 1;
            
            // Hae kaikki kriittiset ilmoitukset sivutettuna
            while (true) {
              const { data } = await githubClient.request('GET', `/repos/${ownerLogin}/${repo.name}/dependabot/alerts`, {
                params: { 
                  per_page: 100, 
                  page: page, 
                  severity: 'critical', 
                  state: 'open' 
                }
              });
              
              const alerts = data || [];
              totalCritical += alerts.length;
              
              console.log(`🔍 Dependabot: ${repo.name} sivu ${page}: ${alerts.length} ilmoitusta (yhteensä: ${totalCritical})`);
              
              // Jos alle 100 ilmoitusta, ollaan viimeisellä sivulla
              if (alerts.length < 100) break;
              page += 1;
              
              // Turvallisuus: max 10 sivua (1000 ilmoitusta)
              if (page > 10) break;
            }
            
            console.log(`✅ Dependabot: ${repo.name} - ${totalCritical} kriittistä ilmoitusta`);
            return totalCritical;
          } catch (dependabotError) {
            // Jos Dependabot ei ole käytössä tai ei pääsyä
            const status = dependabotError.response?.status || dependabotError.status || 'unknown';
            if (status === 403) {
              console.log(`⚠️ Dependabot ei käytössä repossa: ${repo.name} (403)`);
            } else if (status === 404) {
              console.log(`⚠️ Dependabot ei löytynyt reposta: ${repo.name} (404)`);
            } else {
              console.log(`⚠️ Dependabot-virhe reposta ${repo.name}: ${status} - ${dependabotError.message}`);
            }
            return 0;
          }
        });
        
        // Cache the result
        await this.cacheManager.set(dependabotCacheKey, dependabotCriticalCount, 21600000); // 6h cache
        console.log(`💾 Dependabot: cache tallennettu ${repo.name} = ${dependabotCriticalCount}`);
      } else {
        console.log(`💾 Dependabot: käytetään cachea ${repo.name} = ${dependabotCriticalCount}`);
      }
      
      return dependabotCriticalCount;
    } catch (error) {
      console.error(`❌ Virhe Dependabot-tietojen haussa reposta ${repo.name}:`, error.message);
      return 0;
    }
  }

  async getOverview(refresh = false) {
    let repositories = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    // Check if we have complete data
    const hasCompleteData = repositories.length > 0 && repositories.every(repo => 
      repo.dependabot_critical_count !== undefined
    );

    console.log(`🔍 Dependabot: tarkistetaan datan täydellisyys (refresh=${refresh}, repos=${repositories.length})`);
    console.log(`🔍 Dependabot: hasCompleteData=${hasCompleteData}, reposWithData=${repositories.filter(r => r.dependabot_critical_count !== undefined).length}`);

    // Only fetch dependabot data if refresh requested or data is missing
    if (refresh || !hasCompleteData) {
      console.log(`🔄 Haetaan Dependabot-tiedot API:sta (${repositories.length} repo)...`);
      const batchSize = 5; // Smaller batch for Dependabot due to API limits
      
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(repositories.length/batchSize);
        console.log(`📦 Dependabot: batch ${batchNum}/${totalBatches} (${batch.length} repo)`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (repo) => {
            const dependabotCount = await this.getDependabotDataForRepo(repo);
            return { 
              ...repo, 
              dependabot_critical_count: dependabotCount
            };
          })
        );
        
        let successCount = 0;
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const repo = result.value;
            const originalIndex = i + index;
            if (originalIndex < repositories.length) {
              repositories[originalIndex] = repo;
              if (repo.dependabot_critical_count > 0) {
                console.log(`   ✅ ${repo.name}: ${repo.dependabot_critical_count} ilmoitusta`);
              }
              // Update cache if needed
              if (repo.dependabot_critical_count !== undefined) {
                this.repositoryService.repositoryRepository?.saveRepository?.(repo);
              }
              successCount++;
            }
          } else {
            console.error(`   ❌ ${batch[index].name}: ${result.reason?.message || 'unknown error'}`);
          }
        });
        
        console.log(`📦 Dependabot: batch ${batchNum} valmis (${successCount}/${batch.length} onnistui)`);
        
        if (i + batchSize < repositories.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for Dependabot
        }
      }
    } else {
      console.log('💾 Dependabot: käytetään tallennettuja tietoja (ei API-kutsuja)');
    }

    // Partition by alerts
    const reposWithAlerts = repositories.filter(r => (r.dependabot_critical_count || 0) > 0);
    const reposWithoutAlerts = repositories.filter(r => (r.dependabot_critical_count || 0) === 0);

    // Aggregate stats
    const totalCriticalAlerts = reposWithAlerts.reduce((sum, r) => sum + (r.dependabot_critical_count || 0), 0);

    // Collect unique teams from all repositories
    const teamsSet = new Set();
    let reposWithTeams = 0;
    repositories.forEach(repo => {
      let allTeams = repo.all_teams;
      if (typeof allTeams === 'string') {
        try { allTeams = JSON.parse(allTeams); } catch (_) { allTeams = []; }
      }
      if (allTeams && Array.isArray(allTeams) && allTeams.length > 0) {
        allTeams.forEach(t => { if (t && typeof t === 'string' && t.trim()) teamsSet.add(t.trim()); });
        reposWithTeams++;
      } else if (repo.team && typeof repo.team === 'string' && repo.team.trim()) {
        teamsSet.add(repo.team.trim());
        reposWithTeams++;
      }
    });
    const teams = Array.from(teamsSet).sort();

    console.log(`🛡️ Repositoryt ilmoituksilla: ${reposWithAlerts.length} kpl`);
    console.log(`🛡️ Yhteensä kriittisiä ilmoituksia: ${totalCriticalAlerts} kpl`);

    return {
      reposWithAlerts,
      reposWithoutAlerts,
      teams,
      stats: {
        totalRepos: repositories.length,
        reposWithAlerts: reposWithAlerts.length,
        reposWithoutAlerts: reposWithoutAlerts.length,
        totalCriticalAlerts
      }
    };
  }
}

module.exports = DependabotService;



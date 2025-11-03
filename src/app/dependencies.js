/**
 * Dependency injection container
 * Sets up all dependencies and returns configured services
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { config } = require('../core/config');
const DatabaseConnection = require('../data/database/dbConnection');
const MigrationManager = require('../data/migrations/migrationManager');
const RepositoryRepository = require('../data/repositories/repositoryRepository');
const CacheRepository = require('../data/repositories/cacheRepository');
const DatabaseCacheManager = require('../integrations/cache/databaseCacheManager');
const UnifiedCacheManager = require('../integrations/cache/unifiedCacheManager');
const RedisCache = require('../integrations/cache/redisCache');
const RepositoryService = require('../domain/services/repositoryService');
const DjangoService = require('../domain/services/djangoService');
const WordPressService = require('../domain/services/wordpressService');
const DockerService = require('../domain/services/dockerService');
const DrupalService = require('../domain/services/drupalService');
const RepositoryController = require('../app/controllers/repositoryController');
const DjangoController = require('../app/controllers/djangoController');
const WordPressController = require('../app/controllers/wordpressController');
const DockerController = require('../app/controllers/dockerController');
const DrupalController = require('../app/controllers/drupalController');
const createRepositoryRoutes = require('../app/routes/repositories');
const createDjangoRoutes = require('../app/routes/django');
const createWordPressRoutes = require('../app/routes/wordpress');
const createDockerRoutes = require('../app/routes/docker');
const createDrupalRoutes = require('../app/routes/drupal');
const CommitsService = require('../domain/services/commitsService');
const ReactService = require('../domain/services/reactService');
const CommitsController = require('../app/controllers/commitsController');
const ReactController = require('../app/controllers/reactController');
const createCommitsRoutes = require('../app/routes/commits');
const createReactRoutes = require('../app/routes/react');
const TeamsService = require('../domain/services/teamsService');
const DependabotService = require('../domain/services/dependabotService');
const TeamsController = require('../app/controllers/teamsController');
const DependabotController = require('../app/controllers/dependabotController');
const createTeamsRoutes = require('../app/routes/teams');
const createDependabotRoutes = require('../app/routes/dependabot');
const CollaboratorsService = require('../domain/services/collaboratorsService');
const HdsService = require('../domain/services/hdsService');
const CollaboratorsController = require('../app/controllers/collaboratorsController');
const HdsController = require('../app/controllers/hdsController');
const createCollaboratorsRoutes = require('../app/routes/collaborators');
const createHdsRoutes = require('../app/routes/hds');
const IssuesService = require('../domain/services/issuesService');
const IssuesController = require('../app/controllers/issuesController');
const createIssuesRoutes = require('../app/routes/issues');
const LanguagesService = require('../domain/services/languagesService');
const DashboardService = require('../domain/services/dashboardService');
const LanguagesController = require('../app/controllers/languagesController');
const DashboardController = require('../app/controllers/dashboardController');
const createLanguagesRoutes = require('../app/routes/languages');
const createDashboardRoutes = require('../app/routes/dashboard');
const UsersService = require('../domain/services/usersService');
const BranchesService = require('../domain/services/branchesService');
const ReleasesService = require('../domain/services/releasesService');
const ContentsService = require('../domain/services/contentsService');
const UsersController = require('../app/controllers/usersController');
const BranchesController = require('../app/controllers/branchesController');
const ReleasesController = require('../app/controllers/releasesController');
const ContentsController = require('../app/controllers/contentsController');
const createUsersRoutes = require('../app/routes/users');
const createBranchesRoutes = require('../app/routes/branches');
const createReleasesRoutes = require('../app/routes/releases');
const createContentsRoutes = require('../app/routes/contents');
const PullRequestsService = require('../domain/services/pullRequestsService');
const PullRequestsController = require('../app/controllers/pullRequestsController');
const createPullRequestsRoutes = require('../app/routes/pullRequests');

/**
 * Initialize all dependencies
 */
async function initializeDependencies() {
  // Initialize database connection
  let db = null;
  let dbConnection = null;
  let migrationManager = null;

  if (config.app.useDatabase) {
    try {
      dbConnection = new DatabaseConnection(config.database.path, {
        retryAttempts: config.database.retryAttempts,
        retryDelay: config.database.retryDelay,
        busyTimeout: config.database.busyTimeout
      });
      
      db = await dbConnection.connect();
      console.log('💾 Tietokanta käytössä');

      // Initialize migration manager
      migrationManager = new MigrationManager(db);
      
      // Run migrations
      try {
        const migrations = [
          require('../data/migrations/001_initial_schema'),
          require('../data/migrations/002_add_composite_indexes'),
          require('../data/migrations/003_add_wordpress_version')
        ];
        await migrationManager.runMigrations(migrations);
      } catch (migrationError) {
        console.warn('⚠️ Migration error (continuing with fallback):', migrationError.message);
      }
    } catch (error) {
      console.error('❌ Virhe tietokantayhteydessä:', error.message);
      console.log('📦 Käytetään in-memory cachea fallbackina');
      // Fallback to memory-only mode
      db = null;
      dbConnection = null;
    }
  } else {
    console.log('💾 Tietokanta pois käytöstä - käytetään in-memory cachea');
  }

  // Initialize repositories
  const cacheRepository = new CacheRepository(db, config.app.useDatabase);
  const repositoryRepository = new RepositoryRepository(db, migrationManager);
  
  // Initialize database schema (fallback if migrations didn't run)
  if (db && !migrationManager) {
    repositoryRepository.initialize().catch(err => {
      console.error('❌ Virhe tietokannan alustuksessa:', err);
    });
  }

  // Initialize Redis cache (optional)
  let redisCache = null;
  if (config.cache.useRedis) {
    try {
      const redis = require('redis');
      const redisClient = redis.createClient({
        socket: {
          host: config.cache.redisHost,
          port: config.cache.redisPort,
        },
        password: config.cache.redisPassword,
        database: config.cache.redisDb,
      });

      redisClient.on('error', (err) => {
        console.warn('⚠️ Redis connection error:', err.message);
        console.log('📦 Falling back to database/memory cache');
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis connected');
      });

      // Connect to Redis (don't block on error)
      redisClient.connect().catch((err) => {
        console.warn('⚠️ Failed to connect to Redis:', err.message);
        console.log('📦 Falling back to database/memory cache');
      });

      redisCache = new RedisCache(redisClient);
    } catch (error) {
      console.warn('⚠️ Redis module not installed or error:', error.message);
      console.log('📦 Falling back to database/memory cache');
      redisCache = new RedisCache(null); // Disabled Redis
    }
  } else {
    redisCache = new RedisCache(null); // Disabled Redis
  }

  // Initialize unified cache manager (supports Redis + SQLite/Memory fallback)
  const unifiedCacheManager = new UnifiedCacheManager(
    redisCache,
    cacheRepository,
    config
  );

  // Keep DatabaseCacheManager for backward compatibility
  const cacheManager = unifiedCacheManager;

  // Initialize services
  const repositoryService = new RepositoryService(
    repositoryRepository,
    cacheRepository,
    cacheManager
  );
  const djangoService = new DjangoService(cacheManager, repositoryService);
  const wordpressService = new WordPressService(cacheManager, repositoryService);
  const dockerService = new DockerService(cacheManager, repositoryService);
  const drupalService = new DrupalService(cacheManager, repositoryService);
  const reactService = new ReactService(cacheManager, repositoryService);
  const languagesService = new LanguagesService(repositoryService);
  const dashboardService = new DashboardService(repositoryService);
  const hdsService = new HdsService(cacheManager, repositoryService);
  const usersService = new UsersService();
  const branchesService = new BranchesService();
  const releasesService = new ReleasesService();
  const contentsService = new ContentsService();

  // Initialize controllers
  const repositoryController = new RepositoryController(repositoryService);
  const djangoController = new DjangoController(djangoService);
  const wordpressController = new WordPressController(wordpressService);
  const dockerController = new DockerController(dockerService);
  const drupalController = new DrupalController(drupalService);
  const reactController = new ReactController(reactService);
  const languagesController = new LanguagesController(languagesService);
  const dashboardController = new DashboardController(dashboardService);
  const hdsController = new HdsController(hdsService);
  const usersController = new UsersController(usersService);
  const branchesController = new BranchesController(branchesService);
  const releasesController = new ReleasesController(releasesService);
  const contentsController = new ContentsController(contentsService);

  // Initialize routes
  const repositoryRoutes = createRepositoryRoutes(repositoryController);
  const djangoRoutes = createDjangoRoutes(djangoController);
  const wordpressRoutes = createWordPressRoutes(wordpressController);
  const dockerRoutes = createDockerRoutes(dockerController);
  const drupalRoutes = createDrupalRoutes(drupalController);
  const reactRoutes = createReactRoutes(reactController);
  const languagesRoutes = createLanguagesRoutes(languagesController);
  const dashboardRoutes = createDashboardRoutes(dashboardController);
  const hdsRoutes = createHdsRoutes(hdsController);
  const usersRoutes = createUsersRoutes(usersController);
  const branchesRoutes = createBranchesRoutes(branchesController);
  const releasesRoutes = createReleasesRoutes(releasesController);
  const contentsRoutes = createContentsRoutes(contentsController);

  // Initialize commits service and controller
  const commitsService = new CommitsService(cacheManager);
  const commitsController = new CommitsController(commitsService, repositoryService);
  const commitsRoutes = createCommitsRoutes(commitsController);

  // Initialize teams service and controller
  const teamsService = new TeamsService(cacheManager, repositoryService);
  const teamsController = new TeamsController(teamsService, repositoryService);
  const teamsRoutes = createTeamsRoutes(teamsController);

  // Initialize dependabot service and controller
  const dependabotService = new DependabotService(cacheManager, repositoryService);
  const dependabotController = new DependabotController(dependabotService);
  const dependabotRoutes = createDependabotRoutes(dependabotController);

  // Initialize collaborators service and controller
  const collaboratorsService = new CollaboratorsService(cacheManager, repositoryService);
  const collaboratorsController = new CollaboratorsController(collaboratorsService, repositoryService);
  const collaboratorsRoutes = createCollaboratorsRoutes(collaboratorsController);

  // Initialize issues service and controller
  const issuesService = new IssuesService(cacheManager);
  const issuesController = new IssuesController(issuesService);
  const issuesRoutes = createIssuesRoutes(issuesController);

  // Initialize pull requests service and controller
  const pullRequestsService = new PullRequestsService(cacheManager);
  const pullRequestsController = new PullRequestsController(pullRequestsService);
  const pullRequestsRoutes = createPullRequestsRoutes(pullRequestsController);

  return {
    db,
    dbConnection,
    migrationManager,
    cacheRepository,
    repositoryRepository,
    cacheManager: unifiedCacheManager,
    unifiedCacheManager,
    redisCache,
    repositoryService,
    repositoryController,
    dockerController,
    drupalController,
    dependabotController,
    reactController,
    languagesController,
    dashboardController,
    hdsController,
    usersController,
    branchesController,
    releasesController,
    contentsController,
    djangoController,
    wordpressController,
    repositoryRoutes,
    dockerRoutes,
    drupalRoutes,
    dependabotRoutes,
    reactRoutes,
    languagesRoutes,
    dashboardRoutes,
    hdsRoutes,
    usersRoutes,
    branchesRoutes,
    releasesRoutes,
    contentsRoutes,
    djangoRoutes,
    wordpressRoutes,
    commitsService,
    commitsController,
    commitsRoutes,
    teamsService,
    teamsController,
    teamsRoutes,
    collaboratorsService,
    collaboratorsController,
    collaboratorsRoutes,
    issuesService,
    issuesController,
    issuesRoutes,
    pullRequestsService,
    pullRequestsController,
    pullRequestsRoutes
  };
}

module.exports = {
  initializeDependencies
};


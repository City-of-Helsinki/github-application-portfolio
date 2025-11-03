/**
 * Navigation configuration for the sidebar
 * All navigation items are defined here in a single place
 */

const navigationItems = [
  // Yleisnäkymät
  { path: '/', name: 'Etusivu', icon: 'home', iconType: 'material' },
  { path: '/dashboard', name: 'Dashboard', icon: 'dashboard', iconType: 'material' },
  
  // Pääsisältö - Repositoryt
  { path: '/repositories', name: 'Repositoryt', icon: 'folder', iconType: 'material' },
  
  // Teknologia- ja framework-spesifiset
  { path: '/dockerfile', name: 'Dockerfile', icon: 'terminal', iconType: 'material' },
  { path: '/django', name: 'Django', icon: 'hub', iconType: 'material' },
  { path: '/react', name: 'React', icon: 'widgets', iconType: 'material' },
  { path: '/drupal', name: 'Drupal', icon: 'article', iconType: 'material' },
  { path: '/wordpress', name: 'WordPress', icon: 'article', iconType: 'material' },
  { path: '/hds', name: 'HDS', icon: 'palette', iconType: 'material' },
  
  // Aktiivisuus ja yhteistyö
  { path: '/commits', name: 'Commits', icon: 'history', iconType: 'material' },
  { path: '/pull-requests', name: 'Pull Requests', icon: 'merge', iconType: 'material' },
  { path: '/issues', name: 'Issues', icon: 'bug_report', iconType: 'material' },
  { path: '/teams', name: 'Teams', icon: 'groups', iconType: 'material' },
  { path: '/collaborators', name: 'Collaborators', icon: 'diversity_3', iconType: 'material' },
  { path: '/users', name: 'Users', icon: 'group', iconType: 'material' },
  
  // Muut tiedot
  { path: '/branches', name: 'Branches', icon: 'account_tree', iconType: 'material' },
  { path: '/releases', name: 'Releases', icon: 'rocket', iconType: 'material' },
  { path: '/contents', name: 'Contents', icon: 'folder', iconType: 'material' },
  { path: '/languages', name: 'Languages', icon: 'translate', iconType: 'material' },
  
  // Turvallisuus
  { path: '/dependabot', name: 'Dependabot', icon: 'security', iconType: 'material' },
  { path: '/code-scanning', name: 'Code Scanning', icon: 'shield', iconType: 'material' },
  { path: '/licenses', name: 'Licenses', icon: 'description', iconType: 'material' },
];

const settingsItem = {
  path: '/settings',
  name: 'Asetukset',
  icon: 'settings',
  iconType: 'material'
};

module.exports = {
  navigationItems,
  settingsItem,
  getNavigationConfig: () => ({ navigationItems, settingsItem })
};


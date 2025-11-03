/**
 * Language color mappings
 * Centralized location for language colors
 */

const languageColors = {
  'JavaScript': '#f1e05a',
  'TypeScript': '#2b7489',
  'Python': '#3572A5',
  'Java': '#b07219',
  'C++': '#f34b7d',
  'C#': '#239120',
  'Go': '#00ADD8',
  'Rust': '#dea584',
  'PHP': '#4F5D95',
  'Ruby': '#701516',
  'Swift': '#ffac45',
  'Kotlin': '#A97BFF',
  'Dart': '#00B4AB',
  'HTML': '#e34c26',
  'CSS': '#1572B6',
  'Vue': '#4FC08D',
  'React': '#61DAFB',
  'Angular': '#DD0031',
  'Node.js': '#339933',
  'Shell': '#89e051',
  'Dockerfile': '#384d54',
  'YAML': '#cb171e',
  'JSON': '#000000',
  'Markdown': '#083fa1',
  'SQL': '#336791',
  'R': '#198CE7',
  'Scala': '#c22d40',
  'Clojure': '#db5855',
  'Haskell': '#5e5086',
  'Elixir': '#6e4a7e',
  'Erlang': '#a90533',
  'Lua': '#000080',
  'Perl': '#0298c3',
  'PowerShell': '#012456',
  'Assembly': '#6E4C13',
  'C': '#555555',
  'Objective-C': '#438eff',
  'Roff': '#ecdebe',
  'TeX': '#3D6117',
  'Vim script': '#199f4b',
  'Emacs Lisp': '#c065db',
  'Makefile': '#427819',
  'CMake': '#064F8C',
  'Batchfile': '#C1F12E',
  'INI': '#d1dbe0',
  'TOML': '#9c4221',
  'XML': '#005f9f',
  'SVG': '#ff9900',
  'GraphQL': '#e10098',
  'Solidity': '#AA6746',
  'WebAssembly': '#654FF0',
  'Svelte': '#ff3e00',
  'Next.js': '#000000',
  'Nuxt.js': '#00DC82',
  'Gatsby': '#663399'
};

/**
 * Get color for a language
 */
function getLanguageColor(language) {
  return languageColors[language] || '#6c757d';
}

module.exports = {
  languageColors,
  getLanguageColor
};


function parseLinkHeader(header) {
  if (!header) return {};
  const links = {};
  const parts = header.split(',');
  for (const p of parts) {
    const section = p.split(';');
    if (section.length !== 2) continue;
    const url = section[0].trim().replace(/^<|>$/g, '');
    const name = section[1].trim().replace(/^rel="(.*)"$/, '$1');
    links[name] = url;
  }
  return links;
}

module.exports = { parseLinkHeader };



/** True when both paths refer to the same route, with or without a trailing slash. */
export const isActive = (pathname: string, href: string) => {
  const normalize = (path: string) => (path.endsWith('/') ? path : `${path}/`);
  return normalize(pathname) === normalize(href);
};

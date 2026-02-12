export const slugFromModelId = (id: string): string =>
  id
    .split('/')
    .pop()!
    .split(':')[0]
    .replace(/\./g, '-');

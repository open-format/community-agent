export interface Community {
  id: string;
  name: string;
  owner: { id: string };
}

export interface Config {
  configurable: {
    metadata: { community: Community };
  };
}

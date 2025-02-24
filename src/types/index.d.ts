export interface Community {
  name: string;
  owner: { id: string };
}

export interface Config {
  configurable: {
    metadata: { community: Community };
  };
}

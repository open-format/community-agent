export const mockCommunity = {
  id: "a0c8a735-9a82-4c29-971a-e1dfddb88efa",
  name: "Test Community",
  description: "A test community",
  goals: [],
  platforms: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  slug: "test-community",
  accentColor: "#6366F1",
  tokenLabel: "Points",
  userLabel: "User",
  participantLabel: "Participant",
  darkMode: false,
};

export const mockUser = {
  id: "58dfcb6b-5211-41fa-afaa-4b87da7bfe19",
  did: "did:privy:123",
  nickname: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAdminRole = {
  id: "54d4fcd9-d5fa-4959-8e9c-31040e9499c6",
  communityId: mockCommunity.id,
  name: "Admin",
  description: "Community administrator",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockUserCommunityRole = {
  id: "57666e66-785b-499b-9027-3510c981317c",
  userId: mockUser.id,
  communityId: mockCommunity.id,
  roleId: mockAdminRole.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

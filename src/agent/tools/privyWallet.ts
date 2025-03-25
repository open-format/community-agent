export const createPrivyWalletTool = {
  id: 'createPrivyWallet',
  description: 'Creates a new Privy wallet for a user',
  execute: async ({ context }: { 
    context: { 
      username: string,
      platform: string 
    } 
  }) => {
    try {
      const response = await fetch(`https://auth.privy.io/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'privy-app-id': process.env.PRIVY_APP_ID!,
          'Authorization': `Basic ${Buffer.from(`${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`).toString('base64')}`
        },
        body: JSON.stringify({
          create_ethereum_wallet: true,
          create_ethereum_smart_wallet: true,
          linked_accounts: [{
            type: 'discord_oauth',
            subject: context.username,
            username: context.username
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Privy API Error:', errorData);
        throw new Error(`Failed to create wallet: ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ''}`);
      }

      const user = await response.json();
      const walletAccount = user.linked_accounts.find((acc: any) => acc.type === 'wallet');
      
      if (!walletAccount?.address) {
        throw new Error('Wallet creation failed - no ethereum wallet found');
      }

      return {
        walletAddress: walletAccount.address,
        isPregenerated: true
      };
    } catch (error) {
      console.error('Failed to create Privy wallet:', error);
      throw error;
    }
  }
}; 
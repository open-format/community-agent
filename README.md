<div align="center">
    <img src="./repo.webp" alt="Community Agent Logo" style="border-radius: 15px; max-width: 500px;">
</div>
The community agent is an API designed to enhance community engagement and reward contributions, particularly within open-source projects. It listens for GitHub webhook events, verifies contributions, and automatically rewards contributors with tokens. It also features an intelligent agent powered by LangGraph to assist with community onboarding and management.

Key features include:

- **GitHub Webhook Integration:** Receives and processes GitHub webhook events for code contributions.
- **Automated Rewards:** Automatically rewards contributors with tokens for their contributions.
- **Discord Notifications:** Sends notifications to Discord channels for contributions and missed reward opportunities.
- **Community Onboarding Agent:** Uses a LangGraph agent with OpenAI to guide new members through the community onboarding process.
- **Document Processing:** Allows uploading and processing of community documents for knowledge retrieval and question answering.

### Local Development

#### Prerequisites

Before you begin, ensure you have the following installed:

- **[Bun](https://bun.sh/docs/installation):** Community Agent is built using Bun. Follow the installation instructions on the Bun website.
- **[PostgreSQL:** A PostgreSQL database (with pgvector extension) is required for data persistence.
- **Environment Variables:** You need to set up the necessary environment variables. See the [Environment Variables](#environment-variables) section for details.

#### Installation

1. **Clone the repository:**

   ```sh
   git clone https://github.com/openformat/community-agent
   cd community-agent
   ```

2. **Install dependencies:**

   ```sh
   bun install
   ```

#### Running the API

1. **Set up your database:**

   - Ensure your PostgreSQL database is running.
   - Create a `.env` file in the project root and configure your `DATABASE_URL` environment variable (see [Environment Variables](#environment-variables)).
   - Setup database run migrations:

     ```sh
     bun run db:setup
     ```

2. **Start the development server:**

   ```sh
   bun run dev
   ```

   The API will be accessible at `http://localhost:8080`. You can access the agent endpoints and documentation routes if API_KEY is provided.

3. **Access API documentation (if enabled):**

   If you have the API documentation routes enabled, you can access them at `http://localhost:8080/docs` after setting the `API_KEY` environment variable.

### Deployment (Fly.io)

Community Agent is configured for easy deployment on [Fly.io](https://fly.io).

#### Prerequisites

- **[Fly.io CLI](https://fly.io/docs/flyctl/installing/):** Install the Fly.io command-line interface.
- **Fly.io account:** Create an account on Fly.io.

#### Deployment Steps

1. **Initialize Fly.io app:**

   If you haven't already, initialize a Fly.io app in your project directory:

   ```sh
   flyctl launch
   ```

   Follow the prompts to set up your Fly.io application. Ensure you select a region close to your users (e.g., `lhr`).

2. **Set environment variables:**

   Set the necessary environment variables in your Fly.io application. You can use the Fly.io CLI:

   ```sh
   flyctl secrets set GITHUB_WEBHOOK_SECRET="your_github_webhook_secret" \
                      PRIVY_APP_ID="your_privy_app_id" \
                      PRIVY_APP_SECRET="your_privy_app_secret" \
                      COMMUNITY_ADDRESS="your_community_contract_address" \
                      POINTS_TOKEN_ADDRESS="your_points_token_address" \
                      PRIVATE_KEY="your_private_key" \
                      DATABASE_URL="your_database_url" \
                      DISCORD_TOKEN="your_discord_bot_token" \
                      DISCORD_CHANNEL_ID="your_discord_channel_id" \
                      OPENAI_API_KEY="your_openai_api_key" \
                      API_KEY="your_api_key_for_docs_and_agent"
   ```

   Replace the placeholder values with your actual secrets and configuration.

3. **Deploy the application:**

   Deploy your application to Fly.io:

   ```sh
   flyctl deploy
   ```

   This command builds the Docker image and deploys it to Fly.io.

### Environment Variables

You need to configure the following environment variables for the API to function correctly. You can set these in your `.env` file for local development or as Fly.io secrets for deployment.

| Variable                | Description                                                                    | Required | Example                                         |
| ----------------------- | ------------------------------------------------------------------------------ | -------- | ----------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Secret used to verify GitHub webhook signatures.                               | Yes      | `your_secret_string`                            |
| `PRIVY_APP_ID`          | Privy application ID for user authentication.                                  | Yes      | `your_privy_app_id`                             |
| `PRIVY_APP_SECRET`      | Privy application secret for user authentication.                              | Yes      | `your_privy_app_secret`                         |
| `COMMUNITY_ADDRESS`     | Address of the community contract.                                             | Yes      | `0xYourCommunityContractAddress`                |
| `POINTS_TOKEN_ADDRESS`  | Address of the points token contract (e.g., $DEV token).                       | Yes      | `0xYourPointsTokenAddress`                      |
| `PRIVATE_KEY`           | Private key for the wallet client to sign transactions (e.g., reward minting). | Yes      | `0xyour_private_key_hex_string`                 |
| `DATABASE_URL`          | Connection string for your PostgreSQL database.                                | Yes      | `postgresql://user:password@host:port/database` |
| `DISCORD_TOKEN`         | Discord bot token for sending notifications.                                   | Yes      | `your_discord_bot_token`                        |
| `DISCORD_CHANNEL_ID`    | Discord channel ID to send notifications to.                                   | Yes      | `your_discord_channel_id`                       |
| `OPENAI_API_KEY`        | OpenAI API key for the community onboarding agent.                             | Yes      | `sk-your_openai_api_key`                        |
| `PORT`                  | Port the API will listen on (default: `8080`).                                 | No       | `3000`                                          |
| `API_KEY`               | API key to protect `/docs` and `/agent` routes.                                | Yes      | `your_api_key`                                  |

<div align="center">
    <img src="./repo.webp" alt="Community Agent Logo" style="border-radius: 15px; max-width: 500px;">
</div>

# Community Agent

The Community Agent is an API designed to listen, evaluate, and reward contributions for open-source projects. It monitors activity across platforms like GitHub and Discord, intelligently determines the value of contributions, and automatically rewards contributors with on-chain tokens.

## Key Features

- **Multi-Platform Monitoring:** Listens to activity across GitHub, Discord, and more platforms in the future.
- **Intelligent Contribution Evaluation:** Uses Mastra.ai to analyze and score contributions based on quality and impact.
- **Automated On-Chain Rewards:** Automatically rewards valuable contributions with tokens on the blockchain.
- **GitHub Integration:** Processes GitHub webhook events for code contributions, issues, discussions, and more.
- **Discord Activity Tracking:** Monitors messages, reactions, and voice channel participation within Discord communities.
- **Message Scoring:** Evaluates the quality and relevance of community messages to identify valuable contributions.
- **Document Processing:** Enables uploading and processing of community documents for knowledge retrieval and question answering.
- **Community Insights:** Provides analytics on community engagement and contribution patterns.

### Local Development

#### Option 1: Using Docker Compose (Recommended)

Docker Compose provides the easiest way to set up and run the Community Agent locally with all its dependencies.

1. **Prerequisites:**
   - [Docker](https://docs.docker.com/get-docker/)
   - [Docker Compose](https://docs.docker.com/compose/install/)

2. **Clone the repository:**
   ```sh
   git clone https://github.com/openformat/community-agent
   cd community-agent
   ```

3. **Create environment file:**
   ```sh
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration values (see [Environment Variables](#environment-variables) section).

4. **Make the entrypoint script executable:**
   ```sh
   chmod +x docker/entrypoint.sh
   ```
   This step is required on Unix-based systems (Linux/macOS) to ensure the script can be executed.

5. **Start Docker Compose:**
   ```sh
   docker compose up
   ```
   This will:
   - Build the application container
   - Start a PostgreSQL database with pgvector extension
   - Automatically run database migrations
   - Run the application in development mode with hot reloading
   - Mount your local code for easy development

6. **Access the API:**
   The API will be available at `http://localhost:8080`

7. **Accessing the database:**
   The PostgreSQL database is exposed on port 5433 (instead of the default 5432) to avoid conflicts with any local Postgres installations. If you need to connect to the database directly from your host machine:
   ```
   Host: localhost
   Port: 5433
   Username: postgres
   Password: postgres
   Database: community_agent
   ```

8. **Useful Docker commands:**
   ```sh
   # View logs
   docker compose logs -f
   
   # Stop all services
   docker compose down
   
   # Rebuild containers (after dependency changes)
   docker compose build --no-cache
   
   # Reset database
   docker compose exec app bun run db:reset
   ```

#### Option 2: Manual Setup

Before you begin, ensure you have the following installed:

- **[Bun](https://bun.sh/docs/installation):** Community Agent is built using Bun. Follow the installation instructions on the Bun website.
- **[PostgreSQL](https://www.postgresql.org/download/):** A PostgreSQL database (with pgvector extension) is required for data persistence.
- **Environment Variables:** You need to set up the necessary environment variables. See the [Environment Variables](#environment-variables) section for details.

1. **Clone the repository:**
   ```sh
   git clone https://github.com/openformat/community-agent
   cd community-agent
   ```

2. **Install dependencies:**
   ```sh
   bun install
   ```

3. **Set up your database:**
   - Ensure your PostgreSQL database is running.
   - Create a `.env` file in the project root and configure your `DATABASE_URL` environment variable.
   - Setup database and run migrations:
     ```sh
     bun run db:setup
     ```

4. **Start the development server:**
   ```sh
   bun run dev
   ```
   The API will be accessible at `http://localhost:8080`.

5. **Access API documentation (if enabled):**
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
| `PORT`                  | Port the API will listen on (default: `8080`).                                 | No       | `8080`                                          |
| `API_KEY`               | API key to protect `/docs` and `/agent` routes.                                | Yes      | `your_api_key`                                  |
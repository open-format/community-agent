# [0.32.0](https://github.com/open-format/community-agent/compare/v0.31.1...v0.32.0) (2025-06-07)


### Bug Fixes

* Fixed retry mechanism for identifyRewardsStep batch processing ([4086f06](https://github.com/open-format/community-agent/commit/4086f06ce0e2fdcfbbb85354e0aa4690f437281e))
* Fixed time range for rewards recommendations ([4c72dcd](https://github.com/open-format/community-agent/commit/4c72dcd5c0f3ab3f8224b8dadada27bd3da736e6))
* Fixing error logger calls ([c9cde6d](https://github.com/open-format/community-agent/commit/c9cde6d2ba993e241d8fab2185503c4c4abceab7))
* Fixing evidence and platformType for rewards ([6fce181](https://github.com/open-format/community-agent/commit/6fce1813c81287a691832f22a6d49a3faf6ccd8f))
* Fixing markdown in telegram impact report ([70879fa](https://github.com/open-format/community-agent/commit/70879fa63b03d3d750f5d012d31aeeadbad1ac73))


### Features

* Added combined report for communities ([e075010](https://github.com/open-format/community-agent/commit/e07501029e9db585f91a153b248952236b74422e))
* Added endpoint to update platformConnections ([380c1b4](https://github.com/open-format/community-agent/commit/380c1b44feddcb8e75643d5c1c879ea4c10fbc64))
* Added Telegram support in rewards recommendations ([0d7cd03](https://github.com/open-format/community-agent/commit/0d7cd03a614578ba26b0610eac3ab30f25c7d90a))
* Enhance Telegram bot onboarding and error handling ([832feec](https://github.com/open-format/community-agent/commit/832feec42cbad085874566849fd6d1e3fac7b66a))
* Integrated combined impact report into API ([8fbd4ce](https://github.com/open-format/community-agent/commit/8fbd4ce4a1e6a89ac622fcda37fabd0208f6ebe4))
* Removed community creation when creating new platform ([a3072db](https://github.com/open-format/community-agent/commit/a3072db3b650cb86cbc8d02fcf32409c611d6ab8))
* Updating bun.lock ([26e4aa3](https://github.com/open-format/community-agent/commit/26e4aa3082a05803374d6257f481f938d60eb5fd))

## [0.31.1](https://github.com/open-format/community-agent/compare/v0.31.0...v0.31.1) (2025-06-04)


### Bug Fixes

* Fixed retry mechanism for identifyRewardsStep batch processing ([6b03db4](https://github.com/open-format/community-agent/commit/6b03db4a76971b80e40007f7cd63242852e19c21))

# [0.31.0](https://github.com/open-format/community-agent/compare/v0.30.0...v0.31.0) (2025-05-30)


### Features

* Fixed embeddings generation err when message content is empty ([da65b66](https://github.com/open-format/community-agent/commit/da65b6609fe621509d0daa33360bae8468881c8b))

# [0.30.0](https://github.com/open-format/community-agent/compare/v0.29.0...v0.30.0) (2025-05-28)


### Bug Fixes

* **communities:** conditionally retrieve on-chain data for community ([1e9e014](https://github.com/open-format/community-agent/commit/1e9e014fa4ffe58baa859b47123e2d84337ffb34))
* **communities:** update snapshot to return only the first sorted result ([22ff530](https://github.com/open-format/community-agent/commit/22ff5309ee75ce844ccebd122d1ea5a77209f69a))
* Rename jobId variable to job_id for consistency in report generation process ([a9676fd](https://github.com/open-format/community-agent/commit/a9676fd4e064fc722c53b0dfe1eadebc777c4ad7))
* Update batch processing logic to retry failed batches in rewards identification ([472ad10](https://github.com/open-format/community-agent/commit/472ad10518b220a61834e21a913b677187c42943))
* Update users table to set id column data type to uuid with casting ([2fcd728](https://github.com/open-format/community-agent/commit/2fcd7282dcbce8fb64c98be8bcf3eb458fcb5797))


### Features

* Add background fetching of historical messages with job status updates ([d7fe65b](https://github.com/open-format/community-agent/commit/d7fe65b1248cce7ce1180ec519f1772a2c63bd36))
* Add CRUD endpoints for managing users in the Community Agent ([caa2faf](https://github.com/open-format/community-agent/commit/caa2fafbb6a5eacc51277a5f5f353e8129d04afc))
* Add getCommunities endpoint to retrieve communities where the user has Admin role ([f8f8d16](https://github.com/open-format/community-agent/commit/f8f8d16b342598038964cbe707314b9fd4e08d08))
* Add migration for setting default slug value to gen_random_uuid() in communities table ([6fa7cf0](https://github.com/open-format/community-agent/commit/6fa7cf00fea19a2c9374a408b82f4305a4aca9ad))
* Add Open Format - Agent API Postman collection for community, reports, summaries, webhooks, rewards, and users ([9f8ab70](https://github.com/open-format/community-agent/commit/9f8ab7030a2a215d3f825aeae3ce6bc027a1c6f7))
* Add roles support ([01280f2](https://github.com/open-format/community-agent/commit/01280f224cd2e9c29164f4bebbe3d2209a1e9543))
* Add roles support ([b8776a7](https://github.com/open-format/community-agent/commit/b8776a77b96013b07565b753d75725671507b266))
* **communities:** add slug generation for community names on guild creation ([2757d98](https://github.com/open-format/community-agent/commit/2757d9852ffa60742d17727aef5be7628a888df7))
* **communities:** implement pagination and error handling for community retrieval ([1ef1ef8](https://github.com/open-format/community-agent/commit/1ef1ef8e27d7cbe60a8039d61d0c4f2b52088a5d))
* **database:** add tiers table and update communities schema ([57410ac](https://github.com/open-format/community-agent/commit/57410acaba3c632f88e654a44f062aada02cddd8))
* Enhance Discord guild creation with platform connection check and update community slug generation ([bb6dab3](https://github.com/open-format/community-agent/commit/bb6dab329f03560a44ffa39a319470b180714a5f))
* Implement batch processing for rewards identification and enhance evidence formatting ([f1a4492](https://github.com/open-format/community-agent/commit/f1a44926722ce0a1203b9ef6c35209fdda3ac0a1))
* Implement community role assignment and default role creation ([c015ea7](https://github.com/open-format/community-agent/commit/c015ea74dfd6dde76e1bb2a370e4bc0e924326c6))
* Implement historical messages status endpoint and update job creation process ([6347301](https://github.com/open-format/community-agent/commit/6347301565ab2d42c597e230cefafca58a09d16a))
* Introduce community roles and user community management ([1277cb1](https://github.com/open-format/community-agent/commit/1277cb108792063c468cc99d34f03f1fc0e5bd35))

# [0.29.0](https://github.com/open-format/community-agent/compare/v0.28.1...v0.29.0) (2025-05-15)


### Features

* Added community verification mechanism ([dbf4107](https://github.com/open-format/community-agent/commit/dbf41076dd6a5d7d8e435e31183e2a2820611a0d))

## [0.28.1](https://github.com/open-format/community-agent/compare/v0.28.0...v0.28.1) (2025-05-08)


### Bug Fixes

* **impact:** update evidence array validation to require at least one entry ([bcaa9a5](https://github.com/open-format/community-agent/commit/bcaa9a56013d712fa7e6b60fc686fc5231bf95aa))

# [0.28.0](https://github.com/open-format/community-agent/compare/v0.27.3...v0.28.0) (2025-05-06)


### Bug Fixes

* **discord:** improve send command response handling and defer replies ([8bde065](https://github.com/open-format/community-agent/commit/8bde065ca94451003ff86cd350ec4f106b878e12))


### Features

* **chains:** add new chain constants and utility functions ([bf66baa](https://github.com/open-format/community-agent/commit/bf66baafb23e6ebfc444fefa82c18c60d72d3686))
* **communities:** update community by UUID or contract address ([799c5a9](https://github.com/open-format/community-agent/commit/799c5a92181efc26aa5cb52d4917eaaa03a29215))
* **database:** update communities and platform_permissions schema ([4e2b014](https://github.com/open-format/community-agent/commit/4e2b014c801b70dd4137cfe79175ff6a0953ac12))
* **discord:** enhance command registration and autocomplete handling ([05ae58a](https://github.com/open-format/community-agent/commit/05ae58a6fdb1302e90c23307591f0a8dcbff01a3))
* **discord:** enhance send command functionality and error handling ([bb8d644](https://github.com/open-format/community-agent/commit/bb8d644c5a9c18bba2f0d87eae5503708ca80bbc))
* **errors:** add error handling utilities for Viem integration ([0d7cd4f](https://github.com/open-format/community-agent/commit/0d7cd4fea63d80dfe0f32a0c0df02fd14f30aae6))
* **viem:** enhance public and wallet client creation by supporting multiple chains ([5df8bb3](https://github.com/open-format/community-agent/commit/5df8bb39bfc713b56e388cb7c0ad901fcdd398d0))

## [0.27.3](https://github.com/open-format/community-agent/compare/v0.27.2...v0.27.3) (2025-04-22)


### Bug Fixes

* **discord:** increase topK parameter in report command to return more results ([4e75ec6](https://github.com/open-format/community-agent/commit/4e75ec62c9cf1c91663ea8fabcd4421f52d7ce03))

## [0.27.2](https://github.com/open-format/community-agent/compare/v0.27.1...v0.27.2) (2025-04-22)


### Bug Fixes

* **discord:** update report command to return the most recent report based on timestamp ([7850ed4](https://github.com/open-format/community-agent/commit/7850ed4a0c590879fd847a1297b30c27bd06de54))

## [0.27.1](https://github.com/open-format/community-agent/compare/v0.27.0...v0.27.1) (2025-04-17)


### Bug Fixes

* **discord:** correct mention check for bot queries in message handling ([1f18f24](https://github.com/open-format/community-agent/commit/1f18f24beb5998fcbc583d7d0f8f44a033aa8039))

# [0.27.0](https://github.com/open-format/community-agent/compare/v0.26.0...v0.27.0) (2025-04-16)


### Features

* implement impact report generation job and update cron scheduling ([a5312f8](https://github.com/open-format/community-agent/commit/a5312f8f809156dd5fb918952090778d4728ebea))

# [0.26.0](https://github.com/open-format/community-agent/compare/v0.25.0...v0.26.0) (2025-04-15)


### Features

* **discord-bot:** enhance impact report generation with vector queries and improved UX ([06818dd](https://github.com/open-format/community-agent/commit/06818dd7a6425dc800851630f1282505ad2421b6))

# [0.25.0](https://github.com/open-format/community-agent/compare/v0.24.0...v0.25.0) (2025-04-14)


### Bug Fixes

* updated the default start date for the impact report to be 2 weeks ago rather than 1 day ([2e0f922](https://github.com/open-format/community-agent/commit/2e0f92200b76502be3c576100b78ec8fbc69c99b))


### Features

* **discord:** enhance guild management by adding community creation and deletion logic, and improve historical message fetching ([00a2066](https://github.com/open-format/community-agent/commit/00a2066dfba8d867f7fade11fb071dc2eaf4e4a6))
* enhance historical messages tool to support custom date ranges ([b6cb236](https://github.com/open-format/community-agent/commit/b6cb236c474a491cfd784657137e823dcb423068))
* **recommendations:** add cron job for daily reward recommendations generation ([1accd86](https://github.com/open-format/community-agent/commit/1accd86221c98b055ee8be2ebd87ef190cc05520))

# [0.24.0](https://github.com/open-format/community-agent/compare/v0.23.0...v0.24.0) (2025-04-14)


### Bug Fixes

* **communities:** update community creation logic to handle existing communities and adjust schema for optional fields ([fdb67c4](https://github.com/open-format/community-agent/commit/fdb67c49294acf3d6a01c20638db66a48cc95e98))


### Features

* **agent:** add summaryAgent for generating summaries and integrate it into the Mastra agent ([0ec7035](https://github.com/open-format/community-agent/commit/0ec7035a9f2cf50aa8a79a7190028a5af5125587))
* Discord community summarisations via Discord bot ([af2f39e](https://github.com/open-format/community-agent/commit/af2f39e9f0f23768b4aa6a73a27d4618a616fa70))
* **discord:** add script to import Discord conversations into the community_messages vector store ([7132be3](https://github.com/open-format/community-agent/commit/7132be3dd13442725c25d7d4f07d3953ea2a7a65))
* **discord:** enhance guild connection handling by updating existing connections and adding new ones if absent ([e9b4e5a](https://github.com/open-format/community-agent/commit/e9b4e5a611ffc33db5bb19ebbd09f6dca2178781))
* **discord:** implement report generation command and enhance message handling for community insights ([40b5eab](https://github.com/open-format/community-agent/commit/40b5eab4fc201f1efb602a07b1dfa38bab647caa))
* **prompts:** integrate dayjs for date handling and add summaryAgentPrompt for community managers ([11f8693](https://github.com/open-format/community-agent/commit/11f869341ed7b63951023c5466407f5935b62d4d))

# [0.23.0](https://github.com/open-format/community-agent/compare/v0.22.0...v0.23.0) (2025-04-01)


### Features

* add platform_name column to platform_connections table ([405771a](https://github.com/open-format/community-agent/commit/405771a92d6440b5c1d512e044fad02db86b855e))
* implement Discord command for server verification and code generation ([1c3bad3](https://github.com/open-format/community-agent/commit/1c3bad32b8713f031d0142cea47ceef225aa7d21))

# [0.22.0](https://github.com/open-format/community-agent/compare/v0.21.0...v0.22.0) (2025-04-01)


### Features

* Enhance message retrieval and summary workflows by adding optional channelId parameter. Update related API routes and tools to support filtering by channelId, improving message querying capabilities. ([095fdb2](https://github.com/open-format/community-agent/commit/095fdb2bac22fc9394e3ed39efad500d6c817c3f))

# [0.21.0](https://github.com/open-format/community-agent/compare/v0.20.1...v0.21.0) (2025-04-01)


### Bug Fixes

* remove the second paramater for createUnixTimestamp as it was causing problems, and increase topK results to 20 from 5 ([42df2e2](https://github.com/open-format/community-agent/commit/42df2e281e53551b76a7786b72a080d885a3eebe))


### Features

* majorly improved prompt for the ragAgent including injecting the current date and time so it has better context of when messages were sent ([3057208](https://github.com/open-format/community-agent/commit/30572082b617a2b7b27e9a4347140b74fa058b02))

## [0.20.1](https://github.com/open-format/community-agent/compare/v0.20.0...v0.20.1) (2025-04-01)


### Bug Fixes

* for the createUnixTimestamp function when both a date and daysAgo was present it prioritised daysAgo and did that amount of days ago from the present time ([6760316](https://github.com/open-format/community-agent/commit/676031603fb2c66a5dfbb5ecd5714250837287e4))

# [0.20.0](https://github.com/open-format/community-agent/compare/v0.19.0...v0.20.0) (2025-03-27)


### Bug Fixes

* wallet pregeneration error and IPFS upload error ([b15e291](https://github.com/open-format/community-agent/commit/b15e291b5152f1d616cd6bcb5735d6408c8f63bd))


### Features

* add endpoint that gets all the pending rewards ([158eb89](https://github.com/open-format/community-agent/commit/158eb897edbb856b8869acc4b4c4e43c3fe14531))
* add Privy wallet creation tool and API endpoint for Discord users; integrate into rewards workflow for seamless wallet management ([a5dedc4](https://github.com/open-format/community-agent/commit/a5dedc4b83915399dfefead5f72752e063def46a))
* added endpoint to delete a pending reward once it has either been rewarded or rejected ([9bdf68b](https://github.com/open-format/community-agent/commit/9bdf68bed27b170073600a53b9409bedd4c90d7f))
* create pending_rewards table and associated metadata; update journal and snapshot for new schema version ([0af353f](https://github.com/open-format/community-agent/commit/0af353f007d3110192697291db1132bf86ba33b7))
* enhance rewards identification and evidence structure; update savePendingReward tool and schema for improved metadata handling ([4f5b50d](https://github.com/open-format/community-agent/commit/4f5b50d88774d67dd6f596c47cd154d15bf1b631))
* implement community rewards analysis workflow with new tools and API endpoint for identifying and suggesting rewards based on contributions ([ec3c8f8](https://github.com/open-format/community-agent/commit/ec3c8f83aac98bb967c3d29d1c78f397472c4001))
* update rewards agent to use Google Gemini model and enhance reward identification criteria; improve evidence structure and output format in rewards workflow ([1d5eff2](https://github.com/open-format/community-agent/commit/1d5eff2914e4df0f421f16e3d54690197ec79dcc))

# [0.19.0](https://github.com/open-format/community-agent/compare/v0.18.0...v0.19.0) (2025-03-27)


### Bug Fixes

* update historical messages endpoint to use platformId and newMessagesAdded ([bce9256](https://github.com/open-format/community-agent/commit/bce9256934c7f6192545ea61f1362d68ce09bd76))


### Features

* add API route for fetching historical messages ([8d5fcbe](https://github.com/open-format/community-agent/commit/8d5fcbe54826faed392e906c8213c1055b621047))
* add historical messages fetching tool and API endpoint ([e00ad6f](https://github.com/open-format/community-agent/commit/e00ad6f3f0d7621483249f7bca7ada50b627e997))

# [0.18.0](https://github.com/open-format/community-agent/compare/v0.17.0...v0.18.0) (2025-03-27)


### Bug Fixes

* change summary model to gpt-4o-mini so that it does not exceed gpt 4o's 450,000 token per minute limit ([34ee7dc](https://github.com/open-format/community-agent/commit/34ee7dc7ad15ee55c43e92be59dd6f33ae1cb917))
* includeStats filter now completely filters all stats, if its false it just returns a transcript ([924c248](https://github.com/open-format/community-agent/commit/924c2488e2ab5e873e415d8806b54c424e850617))
* updated to support unix timestamp ([454d0cb](https://github.com/open-format/community-agent/commit/454d0cb05adcb05c3aca334a35a5e4bcb229498b))


### Features

* add createUnixTimestamp function for flexible timestamp generation ([dc9ac52](https://github.com/open-format/community-agent/commit/dc9ac52d4d9001940751ce14341678f4f2528d3b))
* add impact report workflow and related tools, update API routes ([4f462ab](https://github.com/open-format/community-agent/commit/4f462abb9331aef9029668d95e974d4b3f91a769))
* add Redis service to docker-compose for improved caching ([5420cdf](https://github.com/open-format/community-agent/commit/5420cdfaff70a2fe20e038bf1a33636c21d25640))
* add report endpoint ([cafa381](https://github.com/open-format/community-agent/commit/cafa38188793a53bcd6eb1349b37faffdbdb798b))
* added the ability to save the summaries and impact reports into a vector store ([6a2f1a8](https://github.com/open-format/community-agent/commit/6a2f1a805d8dae08c4d317201a2900d238fa5a9f))
* enhance impact report schema with channel breakdown and user sentiment analysis; update message formatting functions for improved structure ([f574401](https://github.com/open-format/community-agent/commit/f5744010d1424d4bc07db85b4ad3219d8dea64b7))
* implement report generation and management with Redis integration ([5f49c58](https://github.com/open-format/community-agent/commit/5f49c58a9e6785ba9bf2b8df5c5c3290e5f426e5))
* optionally return message stats when calling the agent/summary api ([b5ba424](https://github.com/open-format/community-agent/commit/b5ba42414a7c99d88342448094c1c931882b40a7))
* test api call for getMessages tool ([640cc2d](https://github.com/open-format/community-agent/commit/640cc2d725bf25a2939341f0bb5569069933ec86))

# [0.17.0](https://github.com/open-format/community-agent/compare/v0.16.0...v0.17.0) (2025-03-25)


### Features

* enhance Discord client to manage platform connections ([c797c55](https://github.com/open-format/community-agent/commit/c797c553a5b99fd8804a4c4eb1c5471198a04d45))

# [0.16.0](https://github.com/open-format/community-agent/compare/v0.15.0...v0.16.0) (2025-03-21)


### Bug Fixes

* exclude previously recorded summaries from summary content ([27167fe](https://github.com/open-format/community-agent/commit/27167fefb140812ecef6a7d83ecfd277c3be76c6))


### Features

* add new database schema for community management and authentication middleware ([d9eea30](https://github.com/open-format/community-agent/commit/d9eea30278ee0d3470db0d69f95ff7e0dfe870c4))
* add script to generate and store synthetic Discord conversations ([24ecfb9](https://github.com/open-format/community-agent/commit/24ecfb9007280e0bb7671a41e900368abeb26736))
* add summaries index and update saveSummary tool ([ddb8436](https://github.com/open-format/community-agent/commit/ddb84369755e926f3825303baefd40ef54f99237))
* enhance agent routes and summary handling ([701096a](https://github.com/open-format/community-agent/commit/701096a2d63f36e37fb256f01f219beacbeb0fe2))
* refactor message fetching and summary workflow ([7394722](https://github.com/open-format/community-agent/commit/73947224dab1c354a2e27eb96e9529900ede39ec))
* update API routes and add documentation endpoint ([90b02f1](https://github.com/open-format/community-agent/commit/90b02f13467135b4409317a85fb3df759a56b94f))
* update conversation generation script for Discord ([f78c234](https://github.com/open-format/community-agent/commit/f78c23408f9ea2b03d724db1d8b8c71e1bc85701))

# [0.15.0](https://github.com/open-format/community-agent/compare/v0.14.0...v0.15.0) (2025-03-19)


### Bug Fixes

* Correct destructuring of database result in community retrieval route ([dba7d22](https://github.com/open-format/community-agent/commit/dba7d22fbbcf9f18c68b144eae81a2d2e438a7ee))


### Features

* Add community schema updates and new SQL migration ([d11cbef](https://github.com/open-format/community-agent/commit/d11cbefb8f6025cf49b4aa150a31457792d968c8))
* Add unique user and message count columns to summaries table ([ae53454](https://github.com/open-format/community-agent/commit/ae5345495629fa2fb67c7766768f3158e9ba4aef))
* Refactor API structure and implement new routes for community and automation management ([f353fa2](https://github.com/open-format/community-agent/commit/f353fa2b4dac79b6a66262aac9472dbb59210bc1))

# [0.14.0](https://github.com/open-format/community-agent/compare/v0.13.0...v0.14.0) (2025-03-17)


### Features

* Implement RAG agent with new memory and vector query capabilities ([d35e8fe](https://github.com/open-format/community-agent/commit/d35e8fe656ebcc9b1127c124ef47866bbd63b556))
* Refactor document processing to use new embedding and storage methods ([85ad72d](https://github.com/open-format/community-agent/commit/85ad72d545ac6ad48853b8a422b0c6f6a9a0410c))

# [0.13.0](https://github.com/open-format/community-agent/compare/v0.12.0...v0.13.0) (2025-03-17)


### Features

* Add platform_connections table and update schema ([8098581](https://github.com/open-format/community-agent/commit/8098581db72a667677ff3dfd20bfc565cf34c8d7))
* Add time validation utility function ([c755d75](https://github.com/open-format/community-agent/commit/c755d7500de8f662255c08d24b5f6c73ac3c670d))
* Refactor Discord client and implement voice channel automation ([dc5cc62](https://github.com/open-format/community-agent/commit/dc5cc627d2e9583502d4a391f0933510b13c3e86))
* Update development script and add dayjs dependency ([a6f2974](https://github.com/open-format/community-agent/commit/a6f2974de54db400978ce8f7adfd48932357ffc8))

# [0.12.0](https://github.com/open-format/community-agent/compare/v0.11.0...v0.12.0) (2025-03-17)


### Features

* Add communities route for community management ([f980d1c](https://github.com/open-format/community-agent/commit/f980d1cab11db5503169dda219b30db9d86fe525))
* Add trigger automation functionality and enhance routes ([404209a](https://github.com/open-format/community-agent/commit/404209a19ac7715d0c4931aa55ff642b047430b2))
* Integrate PrivyClient for community wallet management ([2e68d1b](https://github.com/open-format/community-agent/commit/2e68d1b454b8b125d82114b9a62b2e8e9eec8c7f))
* Update community schema and relationships ([b982369](https://github.com/open-format/community-agent/commit/b9823699c379deb38db9f42c7351491a85377a80))

# [0.11.0](https://github.com/open-format/community-agent/compare/v0.10.0...v0.11.0) (2025-03-17)


### Features

* Add Biome configuration file and update package dependencies ([64529f8](https://github.com/open-format/community-agent/commit/64529f883277f89487c7c642a53cd26393d06fe5))
* Implement automations route and schema for community management ([d6da318](https://github.com/open-format/community-agent/commit/d6da3184ac4bca7308ebc0389f07dc60818b238b))
* Introduce new database schema for community management ([074dc9f](https://github.com/open-format/community-agent/commit/074dc9f1e4c7fd20e89162ecc36da4b29d28bf7c))

# [0.10.0](https://github.com/open-format/community-agent/compare/v0.9.0...v0.10.0) (2025-03-06)


### Features

* Improve error handling and database connection management ([e0a46b1](https://github.com/open-format/community-agent/commit/e0a46b13804dbb7765814a7a823b779c054d7e98))

# [0.9.0](https://github.com/open-format/community-agent/compare/v0.8.0...v0.9.0) (2025-03-04)


### Features

* Add Google Gemini model support ([57635c5](https://github.com/open-format/community-agent/commit/57635c5d52a522b8a1035c988f4c40707259ec74))
* Add memory management with configurable checkpointing ([cb8263e](https://github.com/open-format/community-agent/commit/cb8263e8e278e0c737fa86b0d9adfd07a22a53b3))
* Enhance community agent with contextual learning and personalised onboarding ([bd3e705](https://github.com/open-format/community-agent/commit/bd3e705a710aaebfe34bb33d5cdf7a5f06131347))

# [0.8.0](https://github.com/open-format/community-agent/compare/v0.7.0...v0.8.0) (2025-02-25)


### Features

* Update README and GitHub webhook processing ([5bd464b](https://github.com/open-format/community-agent/commit/5bd464b5858b1f00dfe08edbd58f31b166a4773d))

# [0.7.0](https://github.com/open-format/community-agent/compare/v0.6.0...v0.7.0) (2025-02-24)


### Features

* Add document processing and QA functionality with OpenAI embeddings ([5934113](https://github.com/open-format/community-agent/commit/593411303884f3081af052137829a546a4a223bd))
* Implement community agent with AI-powered onboarding and interaction tools ([9ef6e87](https://github.com/open-format/community-agent/commit/9ef6e87b4378b044a2b4ff478d839a3df6e8c80a))
* Set up database schema and configuration with Drizzle ORM ([5dad280](https://github.com/open-format/community-agent/commit/5dad2801dab631cbe2315e373c523b725391bc03))

# [0.6.0](https://github.com/open-format/community-agent/compare/v0.5.0...v0.6.0) (2025-02-12)


### Features

* Add GitHub webhook verification middleware and enhance webhook processing ([c7a4331](https://github.com/open-format/community-agent/commit/c7a4331f0e24b6fd2b651de0d98d827e8dac8943))

# [0.5.0](https://github.com/open-format/community-agent/compare/v0.4.0...v0.5.0) (2025-02-12)


### Features

* Enhance GitHub webhook handling with improved user profile checks and Discord notifications ([4ffc756](https://github.com/open-format/community-agent/commit/4ffc756a37689afa152d3759e184dc598ec49b5a))

# [0.4.0](https://github.com/open-format/community-agent/compare/v0.3.0...v0.4.0) (2025-02-12)


### Features

* Add Discord notification for GitHub contribution rewards ([3d10c66](https://github.com/open-format/community-agent/commit/3d10c66fcfd771cd4523218997f0125159e00877))

# [0.3.0](https://github.com/open-format/community-agent/compare/v0.2.0...v0.3.0) (2025-02-12)


### Features

* add Privy and Open Format integration for GitHub contribution rewards ([162af70](https://github.com/open-format/community-agent/commit/162af70cfd1e9bc13acbc6c766dc4bd25eb58859))

# [0.2.0](https://github.com/open-format/community-agent/compare/v0.1.0...v0.2.0) (2025-02-12)


### Features

* add GitHub webhook handling ([ad7ca9b](https://github.com/open-format/community-agent/commit/ad7ca9b27e7d1bc540e0599edd53204f72a8bff8))

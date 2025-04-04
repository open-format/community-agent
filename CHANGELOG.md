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

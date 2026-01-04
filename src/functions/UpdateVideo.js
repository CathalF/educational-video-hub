const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

app.http('UpdateVideo', {
    methods: ['PUT', 'PATCH'],
    authLevel: 'anonymous',
    route: 'videos/{id}',
    handler: async (request, context) => {
        const videoId = request.params.id;
        context.log(`UpdateVideo: ${videoId}`);

        try {
            const updateData = await request.json();

            const querySpec = {
                query: 'SELECT * FROM c WHERE c.id = @id',
                parameters: [{ name: '@id', value: videoId }]
            };

            const { resources: videos } = await container.items
                .query(querySpec)
                .fetchAll();

            if (videos.length === 0) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: false, error: 'Video not found' })
                };
            }

            const existingVideo = videos[0];
            const allowedUpdates = ['title', 'description', 'category', 'tags', 'thumbnailUrl', 'status', 'blobUrl'];

            for (const field of allowedUpdates) {
                if (updateData[field] !== undefined) {
                    existingVideo[field] = updateData[field];
                }
            }
            existingVideo.updatedAt = new Date().toISOString();

            const { resource: savedVideo } = await container.items.upsert(existingVideo);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, data: savedVideo })
            };

        } catch (error) {
            context.log(`Error: ${error.message}`);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: error.message })
            };
        }
    }
});

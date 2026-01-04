const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

app.http('GetVideos', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'videos',
    handler: async (request, context) => {
        context.log('GetVideos function processed a request.');

        try {
            const querySpec = {
                query: 'SELECT * FROM c ORDER BY c.uploadDate DESC'
            };

            const { resources: videos } = await container.items
                .query(querySpec)
                .fetchAll();

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    count: videos.length,
                    data: videos
                })
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

const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

app.http('SearchVideos', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'videos/search',
    handler: async (request, context) => {
        context.log('SearchVideos function processed a request.');

        try {
            const url = new URL(request.url);
            const searchTerm = url.searchParams.get('q') || '';
            const category = url.searchParams.get('category') || '';

            let queryConditions = [];
            let queryParams = [];

            if (searchTerm) {
                queryConditions.push('(CONTAINS(LOWER(c.title), @searchTerm) OR CONTAINS(LOWER(c.description), @searchTerm))');
                queryParams.push({ name: '@searchTerm', value: searchTerm.toLowerCase() });
            }

            if (category) {
                queryConditions.push('c.category = @category');
                queryParams.push({ name: '@category', value: category });
            }

            let query = 'SELECT * FROM c';
            if (queryConditions.length > 0) {
                query += ' WHERE ' + queryConditions.join(' AND ');
            }
            query += ' ORDER BY c.uploadDate DESC';

            const { resources: videos } = await container.items
                .query({ query, parameters: queryParams })
                .fetchAll();

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, count: videos.length, data: videos })
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

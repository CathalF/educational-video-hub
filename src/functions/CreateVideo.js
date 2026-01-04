const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME);
const container = database.container(process.env.COSMOS_CONTAINER_NAME);

app.http('CreateVideo', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'videos',
    handler: async (request, context) => {
        context.log('CreateVideo function processed a request.');

        try {
            const videoData = await request.json();

            if (!videoData.title || !videoData.category) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: false, error: 'Title and category are required' })
                };
            }

            const videoId = videoData.id || `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const newVideo = {
                id: videoId,
                title: videoData.title,
                description: videoData.description || '',
                category: videoData.category,
                uploadedBy: videoData.uploadedBy || 'anonymous',
                uploadDate: new Date().toISOString(),
                blobUrl: videoData.blobUrl || '',
                thumbnailUrl: videoData.thumbnailUrl || '',
                duration: videoData.duration || 0,
                tags: videoData.tags || [],
                views: 0,
                status: videoData.status || 'pending',
                aiMetadata: { transcript: '', keywords: [], speakers: [], topics: [] },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const { resource: createdVideo } = await container.items.create(newVideo);

            return {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, data: createdVideo })
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

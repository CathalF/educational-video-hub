const { app } = require('@azure/functions');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

app.http('GenerateSasToken', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'upload/sas-token',
    handler: async (request, context) => {
        context.log('GenerateSasToken function processed a request.');

        try {
            const requestData = await request.json();
            const { fileName, contentType, containerName = 'videos' } = requestData;

            if (!fileName) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: false, error: 'fileName is required' })
                };
            }

            const allowedContainers = ['videos', 'thumbnails', 'transcripts'];
            if (!allowedContainers.includes(containerName)) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: false, error: 'Invalid container name' })
                };
            }

            const timestamp = Date.now();
            const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const blobName = `${timestamp}-${sanitizedFileName}`;

            const connectionString = process.env.STORAGE_CONNECTION_STRING;
            const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
            const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);

            const accountName = accountNameMatch[1];
            const accountKey = accountKeyMatch[1];

            const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

            const startsOn = new Date();
            const expiresOn = new Date(startsOn.getTime() + 60 * 60 * 1000);

            const sasToken = generateBlobSASQueryParameters({
                containerName: containerName,
                blobName: blobName,
                permissions: BlobSASPermissions.parse('cw'),
                startsOn: startsOn,
                expiresOn: expiresOn,
                contentType: contentType || 'application/octet-stream'
            }, sharedKeyCredential).toString();

            const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
            const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    data: { uploadUrl, blobUrl, blobName, containerName, expiresOn: expiresOn.toISOString() }
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

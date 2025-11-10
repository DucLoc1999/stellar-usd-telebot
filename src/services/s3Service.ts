import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { logger } from '../config/logger';

// AWS Configuration from environment variables
const AWS_REGION = process.env.REGION || 'ap-southeast-1';
const BUCKET_NAME = process.env.BUCKET || 'contract.holdstation.com2';

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.SECRET_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

/**
 * S3 Service for uploading files to AWS S3
 */
class S3Service {
  /**
   * Upload an image file to S3 and return the URL
   * @param localFilePath - Path to the local file to upload
   * @param s3FileName - The key/filename to use in S3 (e.g., 'kyc/123456.jpg')
   * @param contentType - MIME type of the file (default: 'image/jpeg')
   * @returns The S3 URL of the uploaded file
   */
  async uploadImage(
    localFilePath: string,
    s3FileName: string,
    contentType: string = 'image/jpeg'
  ): Promise<string> {
    try {
      logger.info({ localFilePath, s3FileName }, 'Uploading image to S3');

      // Read file content
      const fileContent = readFileSync(localFilePath);

      // Prepare S3 upload parameters
      const params = {
        Bucket: BUCKET_NAME,
        Key: s3FileName,
        Body: fileContent,
        ContentType: contentType,
      };

      // Upload to S3
      const command = new PutObjectCommand(params);
      const response = await s3Client.send(command);

      // Construct the S3 URL
      const fileUrl = `https://s3.${AWS_REGION}.amazonaws.com/${BUCKET_NAME}/${s3FileName}`;

      logger.info(
        { fileUrl, etag: response.ETag, s3FileName },
        'Image uploaded successfully to S3'
      );

      return fileUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, localFilePath, s3FileName },
        'Failed to upload image to S3'
      );
      throw error;
    }
  }

  /**
   * Upload KYC image to S3
   * @param localFilePath - Path to the local KYC image file
   * @param userId - User ID (chat_id) to use in the filename
   * @returns The S3 URL of the uploaded KYC image
   */
  async uploadKycImage(localFilePath: string, userId: number): Promise<string> {
    const s3FileName = `kyc/${userId}_${Date.now()}.jpg`;
    return this.uploadImage(localFilePath, s3FileName, 'image/jpeg');
  }
}

export default new S3Service();

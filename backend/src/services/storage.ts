/**
 * Storage Abstraction Layer
 * Supports local disk and S3-compatible storage (MinIO)
 */

import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface StorageConfig {
  type: 'local' | 's3';
  localPath?: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Region?: string;
}

export interface UploadResult {
  path: string;
  url?: string;
}

export class StorageService {
  private config: StorageConfig;
  private s3Client?: S3Client;

  constructor(config?: StorageConfig) {
    this.config = config || this.getConfigFromEnv();

    if (this.config.type === 's3') {
      this.initializeS3();
    }
  }

  /**
   * Get storage configuration from environment variables
   */
  private getConfigFromEnv(): StorageConfig {
    const storageType = (process.env.STORAGE_TYPE || 'local') as 'local' | 's3';

    if (storageType === 's3') {
      return {
        type: 's3',
        s3Bucket: process.env.S3_BUCKET || 'videoshrink',
        s3Endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        s3AccessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
        s3SecretKey: process.env.S3_SECRET_KEY || 'minioadmin',
        s3Region: process.env.S3_REGION || 'us-east-1',
      };
    }

    return {
      type: 'local',
      localPath: process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'uploads'),
    };
  }

  /**
   * Initialize S3 client
   */
  private initializeS3(): void {
    if (!this.config.s3Endpoint || !this.config.s3AccessKey || !this.config.s3SecretKey) {
      throw new Error('S3 configuration is incomplete');
    }

    this.s3Client = new S3Client({
      endpoint: this.config.s3Endpoint,
      region: this.config.s3Region || 'us-east-1',
      credentials: {
        accessKeyId: this.config.s3AccessKey,
        secretAccessKey: this.config.s3SecretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Upload file
   */
  async upload(filePath: string, destPath: string): Promise<UploadResult> {
    if (this.config.type === 'local') {
      return this.uploadLocal(filePath, destPath);
    }

    return this.uploadS3(filePath, destPath);
  }

  /**
   * Upload file to local storage
   */
  private async uploadLocal(filePath: string, destPath: string): Promise<UploadResult> {
    const fullPath = path.join(this.config.localPath!, destPath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Copy file
    fs.copyFileSync(filePath, fullPath);

    return {
      path: fullPath,
    };
  }

  /**
   * Upload file to S3/MinIO
   */
  private async uploadS3(filePath: string, destPath: string): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket!,
      Key: destPath,
      Body: fileContent,
    });

    await this.s3Client.send(command);

    return {
      path: destPath,
      url: `${this.config.s3Endpoint}/${this.config.s3Bucket}/${destPath}`,
    };
  }

  /**
   * Get signed URL for file download (S3 only)
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (this.config.type === 'local') {
      // For local storage, return relative path
      return `/downloads/${path.basename(filePath)}`;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket!,
      Key: filePath,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Delete file
   */
  async delete(filePath: string): Promise<void> {
    if (this.config.type === 'local') {
      return this.deleteLocal(filePath);
    }

    return this.deleteS3(filePath);
  }

  /**
   * Delete file from local storage
   */
  private async deleteLocal(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Delete file from S3/MinIO
   */
  private async deleteS3(filePath: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.s3Bucket!,
      Key: filePath,
    });

    await this.s3Client.send(command);
  }

  /**
   * Download file (for S3/MinIO)
   */
  async download(filePath: string, destPath: string): Promise<void> {
    if (this.config.type === 'local') {
      // For local storage, just copy
      fs.copyFileSync(filePath, destPath);
      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket!,
      Key: filePath,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('No file content received');
    }

    // Write stream to file
    const writeStream = fs.createWriteStream(destPath);
    const body = response.Body as Readable;

    await new Promise<void>((resolve, reject) => {
      body.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    if (this.config.type === 'local') {
      return fs.existsSync(filePath);
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.s3Bucket!,
        Key: filePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage type
   */
  getType(): 'local' | 's3' {
    return this.config.type;
  }
}

// Export singleton instance
export const storage = new StorageService();

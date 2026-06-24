import { Injectable } from '@nestjs/common';
import cloudinary from '../../config/cloudinary.config';
import { Readable } from 'stream';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadService {
    async uploadImage(file: any): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'lovesync',
                    resource_type: 'image',
                },
                (error, result) => {
                    if (error) return reject(error);
                    if (!result) return reject(new Error('Upload failed'));

                    resolve(result);
                },
            );

            Readable.from(file.buffer).pipe(uploadStream);
        });
    }
}
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { logger } from '../config/logger';

/**
 * FPT AI Vision API Response Types
 */
export interface FptAiVisionIdData {
  id: string;
  name: string;
  dob: string;
  sex: string;
  nationality: string;
  home: string;
  address: string;
  doe: string;
  type?: string;
  features?: string;
  issue_date?: string;
  issue_loc?: string;
  mrz?: string;
  id_fake?: string;
  id_type?: string;
  address_entities?: any;
  overall_score?: number;
}

export interface FptAiVisionResponse {
  data: FptAiVisionIdData[];
  errorCode: string;
  errorMessage: string;
}

/**
 * Service for interacting with FPT AI Vision API
 * Specifically for Vietnamese ID card recognition
 */
export class FptAiVisionService {
  private readonly apiUrl = process.env.FPT_API_SERVICE_URL || '';
  private readonly apiKey = process.env.FPT_API_SERVICE_KEY || '';

  /**
   * Recognize Vietnamese ID card from image file
   * @param imagePath - Path to the image file
   * @returns Parsed ID card data
   */
  async recognizeIdCard(imagePath: string): Promise<FptAiVisionIdData> {
    try {
      logger.info({ imagePath }, 'Calling FPT AI Vision API for ID card recognition');

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Create form data
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      // Make API request
      const response = await axios.post<FptAiVisionResponse>(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'api-key': this.apiKey,
        },
        timeout: 30000, // 30 seconds timeout
      });

      logger.info({ response: response.data }, 'FPT AI Vision API response received');

      // Check for errors
      if (response.data.errorCode && response.data.errorCode !== '0') {
        throw new Error(
          `FPT AI Vision API error: ${response.data.errorMessage || 'Unknown error'}`
        );
      }

      // Check if data exists
      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('No ID card data found in the image');
      }

      const idData = response.data.data[0];

      if (!idData) {
        throw new Error('No ID card data found in the response');
      }

      // Validate required fields
      const requiredFields = ['id', 'name', 'dob', 'sex', 'nationality', 'home', 'address', 'doe'];
      const missingFields = requiredFields.filter(
        (field) => !idData[field as keyof FptAiVisionIdData]
      );

      if (missingFields.length > 0) {
        logger.warn(
          { missingFields, idData },
          'Some required fields are missing from FPT AI Vision response'
        );
      }

      logger.info({ idData }, 'ID card data extracted successfully');

      return idData as FptAiVisionIdData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          {
            error: error.message,
            response: error.response?.data,
            status: error.response?.status,
          },
          'FPT AI Vision API request failed'
        );
        throw new Error(
          `Failed to recognize ID card: ${error.response?.data?.errorMessage || error.message}`
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Error recognizing ID card');
      throw error;
    }
  }

  /**
   * Format date from FPT AI response (DD/MM/YYYY) to Date object
   */
  parseDate(dateString: string | undefined): Date | null {
    try {
      if (!dateString) return null;

      // Expected format: DD/MM/YYYY
      const parts = dateString.split('/');
      if (parts.length !== 3) return null;

      const dayStr = parts[0];
      const monthStr = parts[1];
      const yearStr = parts[2];

      if (!dayStr || !monthStr || !yearStr) return null;

      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10) - 1; // Month is 0-indexed
      const year = parseInt(yearStr, 10);

      const date = new Date(year, month, day);

      // Validate the date
      if (isNaN(date.getTime())) return null;

      return date;
    } catch (error) {
      logger.error({ dateString, error }, 'Error parsing date');
      return null;
    }
  }
}

export default new FptAiVisionService();

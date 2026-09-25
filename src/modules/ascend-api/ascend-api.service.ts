import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AscendApiResponse,
  AscendBodyPartDto,
  AscendEquipmentDto,
  AscendExerciseDto,
} from './dto/ascend-exercise.dto';

@Injectable()
export class AscendApiService {
  private readonly logger = new Logger(AscendApiService.name);
  private readonly apiKey: string;
  private readonly apiHost: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('RAPIDAPI_KEY') ||
      '99b190a402msh00075f9824c208fp13c131jsna849b85796b9';
    this.apiHost =
      this.configService.get<string>('RAPIDAPI_HOST') ||
      'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com';
    this.baseUrl =
      this.configService.get<string>('ASCEND_API_BASE_URL') ||
      'https://edb-with-videos-and-images-by-ascendapi.p.rapidapi.com';
  }

  private get headers(): Record<string, string> {
    return {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': this.apiHost,
      accept: 'application/json',
    };
  }

  async getBodyParts(): Promise<AscendBodyPartDto[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/bodyparts`, {
        headers: this.headers,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = (await res.json()) as AscendApiResponse<AscendBodyPartDto[]>;
      return json.data || [];
    } catch (err) {
      this.logger.warn(`Failed to fetch body parts from AscendAPI: ${(err as Error).message}`);
      return [];
    }
  }

  async getEquipments(): Promise<AscendEquipmentDto[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/equipments`, {
        headers: this.headers,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = (await res.json()) as AscendApiResponse<AscendEquipmentDto[]>;
      return json.data || [];
    } catch (err) {
      this.logger.warn(`Failed to fetch equipments from AscendAPI: ${(err as Error).message}`);
      return [];
    }
  }

  async getExercises(options: {
    limit?: number;
    cursor?: string;
  } = {}): Promise<AscendApiResponse<AscendExerciseDto[]>> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.cursor) params.set('cursor', options.cursor);

      const url = `${this.baseUrl}/api/v1/exercises?${params.toString()}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as AscendApiResponse<AscendExerciseDto[]>;
    } catch (err) {
      this.logger.warn(`Failed to fetch exercises from AscendAPI: ${(err as Error).message}`);
      return { success: false, data: [] };
    }
  }

  async getExerciseById(id: string): Promise<AscendExerciseDto | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/exercises/${encodeURIComponent(id)}`, {
        headers: this.headers,
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = (await res.json()) as AscendApiResponse<AscendExerciseDto>;
      return json.data || null;
    } catch (err) {
      this.logger.warn(`Failed to fetch exercise ${id} from AscendAPI: ${(err as Error).message}`);
      return null;
    }
  }

  async searchExercises(query: string, limit: number = 20): Promise<AscendExerciseDto[]> {
    try {
      const params = new URLSearchParams();
      params.set('search', query);
      params.set('limit', limit.toString());

      const url = `${this.baseUrl}/api/v1/exercises/search?${params.toString()}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = (await res.json()) as AscendApiResponse<AscendExerciseDto[]>;
      return json.data || [];
    } catch (err) {
      this.logger.warn(`Failed to search exercises '${query}' in AscendAPI: ${(err as Error).message}`);
      return [];
    }
  }
}

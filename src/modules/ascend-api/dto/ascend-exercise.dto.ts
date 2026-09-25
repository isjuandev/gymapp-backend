export interface AscendExerciseDto {
  exerciseId: string;
  name: string;
  imageUrl?: string;
  imageUrls?: {
    '360p'?: string;
    '480p'?: string;
    '720p'?: string;
    '1080p'?: string;
  };
  equipments: string[];
  bodyParts: string[];
  exerciseType?: string;
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  videoUrl?: string;
  keywords?: string[];
  overview?: string;
  instructions?: string[];
  exerciseTips?: string[];
  variations?: string[];
}

export interface AscendApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
  };
}

export interface AscendBodyPartDto {
  name: string;
  imageUrl?: string;
}

export interface AscendEquipmentDto {
  name: string;
  imageUrl?: string;
}

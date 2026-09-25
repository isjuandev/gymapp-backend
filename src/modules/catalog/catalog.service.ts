import {
  Injectable,
  NotFoundException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AscendApiService } from '../ascend-api/ascend-api.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import {
  CatalogExerciseResponseDto,
  CatalogListResponseDto,
} from './dto/catalog-exercise-response.dto';
import { EquipmentCategory, MuscleGroup, Prisma } from '@prisma/client';
import { AscendExerciseDto } from '../ascend-api/dto/ascend-exercise.dto';
import {
  BASE_EQUIPMENT,
  BASE_CATALOG,
  BASE_PROGRAMS,
} from './seed-data';

@Injectable()
export class CatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ascendApiService: AscendApiService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureBaseCatalogSeeded();
  }

  async ensureBaseCatalogSeeded() {
    try {
      const catalogCount = await this.prisma.exerciseCatalog.count();
      const programCount = await this.prisma.program.count();
      if (catalogCount < BASE_CATALOG.length || programCount < BASE_PROGRAMS.length) {
        this.logger.log('Seeding base equipment, exercise catalog and programs...');

        // 1. Seed equipment
        for (const eq of BASE_EQUIPMENT) {
          await this.prisma.equipment.upsert({
            where: { id: eq.id },
            update: {
              name: eq.name,
              category: eq.category,
              weightType: eq.weightType,
              minWeightKg: eq.minWeightKg,
              maxWeightKg: eq.maxWeightKg,
              incrementKg: eq.incrementKg,
              externalName: eq.externalName,
              imageAssetName: eq.imageAssetName,
              isAvailableAtGym: eq.isAvailableAtGym,
            },
            create: eq,
          });
        }

        // 2. Seed catalog
        for (const cat of BASE_CATALOG) {
          await this.prisma.exerciseCatalog.upsert({
            where: { externalId: cat.externalId },
            update: cat,
            create: cat,
          });
        }

        // 3. Seed programs, workouts, exercises
        for (const prog of BASE_PROGRAMS) {
          const { workouts, ...programFields } = prog;
          await this.prisma.program.upsert({
            where: { id: programFields.id },
            update: programFields,
            create: programFields,
          });

          for (const w of workouts) {
            const { exercises, ...workoutFields } = w;
            await this.prisma.workout.upsert({
              where: { id: workoutFields.id },
              update: { ...workoutFields, programId: prog.id },
              create: { ...workoutFields, programId: prog.id },
            });

            for (const ex of exercises) {
              await this.prisma.exercise.upsert({
                where: { id: ex.id },
                update: {
                  workoutId: w.id,
                  catalogId: ex.catalogId,
                  name: ex.name,
                  order: ex.order,
                  kind: ex.kind,
                  imageAssetName: ex.imageAssetName,
                  primaryMuscleGroup: ex.primaryMuscleGroup,
                  requiredEquipmentId: ex.requiredEquipmentId,
                  substitutionGroupId: ex.substitutionGroupId,
                  minReps: ex.minReps,
                  maxReps: ex.maxReps,
                  defaultSets: ex.defaultSets,
                  restSeconds: ex.restSeconds,
                },
                create: {
                  id: ex.id,
                  workoutId: w.id,
                  catalogId: ex.catalogId,
                  name: ex.name,
                  order: ex.order,
                  kind: ex.kind,
                  imageAssetName: ex.imageAssetName,
                  primaryMuscleGroup: ex.primaryMuscleGroup,
                  requiredEquipmentId: ex.requiredEquipmentId,
                  substitutionGroupId: ex.substitutionGroupId,
                  minReps: ex.minReps,
                  maxReps: ex.maxReps,
                  defaultSets: ex.defaultSets,
                  restSeconds: ex.restSeconds,
                },
              });
            }
          }
        }
        this.logger.log('Base equipment, exercise catalog and 9-program matrix seeded successfully.');
      }
    } catch (err) {
      this.logger.warn(`Could not auto-seed base catalog: ${(err as Error).message}`);
    }
  }

  async listExercises(query: CatalogQueryDto): Promise<CatalogListResponseDto> {
    const { search, muscleGroup, equipmentCategory, equipmentId, limit = 50, offset = 0 } = query;

    const where: Prisma.ExerciseCatalogWhereInput = {};

    if (muscleGroup) {
      where.primaryMuscleGroup = muscleGroup;
    }

    if (equipmentCategory) {
      where.equipmentCategory = equipmentCategory;
    }

    if (equipmentId) {
      where.equipmentId = equipmentId;
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { nameEs: { contains: term, mode: 'insensitive' } },
        { targetMuscles: { has: term.toLowerCase() } },
        { secondaryMuscles: { has: term.toLowerCase() } },
      ];
    }

    let [items, total] = await Promise.all([
      this.prisma.exerciseCatalog.findMany({
        where,
        include: { equipment: true },
        orderBy: [{ name: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.exerciseCatalog.count({ where }),
    ]);

    // If zero results and a search query was provided, try searching AscendAPI dynamically and caching results
    if (total === 0 && search && search.trim().length > 1) {
      this.logger.log(`No local catalog results for '${search}'. Querying AscendAPI fallback...`);
      try {
        const externalExercises = await this.ascendApiService.searchExercises(search.trim(), 10);
        if (externalExercises.length > 0) {
          for (const ext of externalExercises) {
            await this.upsertFromAscendDto(ext);
          }
          // Re-query local DB after caching
          [items, total] = await Promise.all([
            this.prisma.exerciseCatalog.findMany({
              where,
              include: { equipment: true },
              orderBy: [{ name: 'asc' }],
              skip: offset,
              take: limit,
            }),
            this.prisma.exerciseCatalog.count({ where }),
          ]);
        }
      } catch (err) {
        this.logger.warn(`Fallback search to AscendAPI failed: ${(err as Error).message}`);
      }
    }

    return {
      items: items.map((item) => this.mapToDto(item)),
      total,
      limit,
      offset,
    };
  }

  async getExerciseById(id: string): Promise<CatalogExerciseResponseDto> {
    const item = await this.prisma.exerciseCatalog.findFirst({
      where: {
        OR: [{ id }, { externalId: id }],
      },
      include: { equipment: true },
    });

    if (!item) {
      // Try fetching from AscendAPI directly if ID is external
      const ext = await this.ascendApiService.getExerciseById(id);
      if (ext) {
        const cached = await this.upsertFromAscendDto(ext);
        const reloaded = await this.prisma.exerciseCatalog.findUnique({
          where: { id: cached.id },
          include: { equipment: true },
        });
        if (reloaded) return this.mapToDto(reloaded);
      }
      throw new NotFoundException(`Exercise with id ${id} not found in catalog`);
    }

    return this.mapToDto(item);
  }

  async getMuscleGroups(): Promise<{ value: string; label: string }[]> {
    return [
      { value: MuscleGroup.CHEST, label: 'Pecho' },
      { value: MuscleGroup.BACK, label: 'Espalda' },
      { value: MuscleGroup.LEGS, label: 'Piernas' },
      { value: MuscleGroup.SHOULDERS, label: 'Hombros' },
      { value: MuscleGroup.ARMS, label: 'Brazos' },
      { value: MuscleGroup.CORE, label: 'Abdomen / Core' },
      { value: MuscleGroup.CARDIO, label: 'Cardio' },
      { value: MuscleGroup.FULL_BODY, label: 'Cuerpo Completo' },
    ];
  }

  async syncFromAscendApi(limit: number = 50): Promise<{ syncedCount: number; totalFetched: number }> {
    this.logger.log(`Starting AscendAPI catalog synchronization (limit: ${limit})...`);
    const response = await this.ascendApiService.getExercises({ limit });
    const exercises = response.data || [];
    let syncedCount = 0;

    for (const ext of exercises) {
      try {
        await this.upsertFromAscendDto(ext);
        syncedCount++;
      } catch (err) {
        this.logger.warn(`Failed to sync exercise ${ext.exerciseId} (${ext.name}): ${(err as Error).message}`);
      }
    }

    this.logger.log(`AscendAPI sync completed: ${syncedCount}/${exercises.length} synced.`);
    return { syncedCount, totalFetched: exercises.length };
  }

  private async upsertFromAscendDto(ext: AscendExerciseDto) {
    const muscleGroup = this.mapBodyPartToMuscleGroup(ext.bodyParts);
    const { category, equipmentName } = this.mapEquipmentToCategory(ext.equipments);

    // Try finding matching physical equipment
    const matchedEquipment = await this.findMatchingEquipment(ext.equipments);

    // Resolve best image URL
    const imageUrl =
      ext.imageUrls?.['720p'] ||
      ext.imageUrls?.['480p'] ||
      ext.imageUrls?.['360p'] ||
      ext.imageUrl ||
      null;

    const data = {
      name: ext.name,
      nameEs: ext.name,
      videoUrl: ext.videoUrl || null,
      imageUrl: imageUrl,
      instructions: ext.instructions || [],
      exerciseTips: ext.exerciseTips || [],
      primaryMuscleGroup: muscleGroup,
      targetMuscles: ext.targetMuscles || [],
      secondaryMuscles: ext.secondaryMuscles || [],
      equipmentCategory: category,
      equipmentName: equipmentName,
      equipmentId: matchedEquipment?.id || null,
      suggestedMinReps: 8,
      suggestedMaxReps: 12,
      defaultRestSeconds: 90,
    };

    return this.prisma.exerciseCatalog.upsert({
      where: { externalId: ext.exerciseId },
      update: data,
      create: {
        externalId: ext.exerciseId,
        ...data,
      },
    });
  }

  private async findMatchingEquipment(equipments?: string[]) {
    if (!equipments || equipments.length === 0) return null;
    const firstEq = equipments[0].toLowerCase();

    return this.prisma.equipment.findFirst({
      where: {
        OR: [
          { externalName: { contains: firstEq, mode: 'insensitive' } },
          { name: { contains: firstEq, mode: 'insensitive' } },
        ],
      },
    });
  }

  private mapBodyPartToMuscleGroup(bodyParts?: string[]): MuscleGroup {
    if (!bodyParts || bodyParts.length === 0) return MuscleGroup.FULL_BODY;
    const bp = bodyParts[0].toUpperCase();
    if (bp.includes('CHEST')) return MuscleGroup.CHEST;
    if (bp.includes('BACK')) return MuscleGroup.BACK;
    if (
      bp.includes('CALF') ||
      bp.includes('CALVES') ||
      bp.includes('LEG') ||
      bp.includes('THIGH') ||
      bp.includes('HIP')
    ) {
      return MuscleGroup.LEGS;
    }
    if (bp.includes('SHOULDER') || bp.includes('NECK')) return MuscleGroup.SHOULDERS;
    if (
      bp.includes('ARM') ||
      bp.includes('BICEP') ||
      bp.includes('TRICEP') ||
      bp.includes('FOREARM')
    ) {
      return MuscleGroup.ARMS;
    }
    if (bp.includes('WAIST') || bp.includes('CORE') || bp.includes('ABDOMINAL')) {
      return MuscleGroup.CORE;
    }
    if (bp.includes('CARDIO')) return MuscleGroup.CARDIO;
    return MuscleGroup.FULL_BODY;
  }

  private mapEquipmentToCategory(equipments?: string[]): {
    category: EquipmentCategory;
    equipmentName: string;
  } {
    if (!equipments || equipments.length === 0) {
      return { category: EquipmentCategory.BODYWEIGHT, equipmentName: 'BODY WEIGHT' };
    }
    const raw = equipments[0];
    const eq = raw.toUpperCase();
    if (eq.includes('BARBELL') || eq.includes('DUMBBELL') || eq.includes('KETTLEBELL')) {
      return { category: EquipmentCategory.FREE_WEIGHTS, equipmentName: raw };
    }
    if (eq.includes('BODY') || eq.includes('NONE')) {
      return { category: EquipmentCategory.BODYWEIGHT, equipmentName: raw };
    }
    if (
      eq.includes('CARDIO') ||
      eq.includes('TREADMILL') ||
      eq.includes('BIKE') ||
      eq.includes('ROWER') ||
      eq.includes('ELLIPTICAL')
    ) {
      return { category: EquipmentCategory.CARDIO, equipmentName: raw };
    }
    if (
      eq.includes('BAND') ||
      eq.includes('MAT') ||
      eq.includes('ROPE') ||
      eq.includes('BALL') ||
      eq.includes('FOAM')
    ) {
      return { category: EquipmentCategory.ACCESSORY, equipmentName: raw };
    }
    return { category: EquipmentCategory.STRENGTH, equipmentName: raw };
  }

  private mapToDto(item: any): CatalogExerciseResponseDto {
    return {
      id: item.id,
      externalId: item.externalId,
      name: item.name,
      nameEs: item.nameEs,
      videoUrl: item.videoUrl,
      imageUrl: item.imageUrl,
      instructions: item.instructions || [],
      exerciseTips: item.exerciseTips || [],
      primaryMuscleGroup: item.primaryMuscleGroup,
      targetMuscles: item.targetMuscles || [],
      secondaryMuscles: item.secondaryMuscles || [],
      equipmentCategory: item.equipmentCategory,
      equipmentName: item.equipmentName,
      suggestedMinReps: item.suggestedMinReps,
      suggestedMaxReps: item.suggestedMaxReps,
      defaultRestSeconds: item.defaultRestSeconds,
      equipmentId: item.equipmentId,
      equipment: item.equipment
        ? {
            id: item.equipment.id,
            name: item.equipment.name,
            category: item.equipment.category,
            weightType: item.equipment.weightType,
            incrementKg: item.equipment.incrementKg,
            minWeightKg: item.equipment.minWeightKg,
            maxWeightKg: item.equipment.maxWeightKg,
          }
        : null,
    };
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { Program, Workout } from '@prisma/client';
import { ProgramResponseDto } from './program-response.dto';
import { WorkoutResponseDto } from '../../workouts/dto/workout-response.dto';

export class ProgramDetailResponseDto extends ProgramResponseDto {
  @ApiProperty({
    type: () => [WorkoutResponseDto],
    description: 'List of associated workouts for this program',
  })
  workouts: WorkoutResponseDto[];

  static fromEntityWithWorkouts(
    program: Program & { workouts: Workout[] },
  ): ProgramDetailResponseDto {
    const base = ProgramResponseDto.fromEntity(program);
    return {
      ...base,
      workouts: (program.workouts || []).map((w) =>
        WorkoutResponseDto.fromEntity(w),
      ),
    };
  }
}

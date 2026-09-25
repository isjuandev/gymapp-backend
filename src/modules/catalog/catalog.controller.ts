import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import {
  CatalogExerciseResponseDto,
  CatalogListResponseDto,
} from './dto/catalog-exercise-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('exercises')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Search & filter exercises from the unified catalog',
    description: 'Lists exercises with video URLs, instructions, muscle targeting and progression equipment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of catalog exercises',
    type: CatalogListResponseDto,
  })
  async listExercises(@Query() query: CatalogQueryDto): Promise<CatalogListResponseDto> {
    return this.catalogService.listExercises(query);
  }

  @Get('muscles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List available muscle groups for filtering',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of muscle groups',
  })
  async getMuscleGroups(): Promise<{ value: string; label: string }[]> {
    return this.catalogService.getMuscleGroups();
  }

  @Get('exercises/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get single exercise details by ID or external ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercise details with equipment info',
    type: CatalogExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  async getExerciseById(@Param('id') id: string): Promise<CatalogExerciseResponseDto> {
    return this.catalogService.getExerciseById(id);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Trigger sync of exercises from AscendAPI into local catalog',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync status and count',
  })
  async syncCatalog(
    @Body('limit') limit?: number,
  ): Promise<{ syncedCount: number; totalFetched: number }> {
    return this.catalogService.syncFromAscendApi(limit || 50);
  }
}

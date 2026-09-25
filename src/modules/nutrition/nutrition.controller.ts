import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NutritionService } from './nutrition.service';
import {
  CreateMealDto,
  CreateMealEntryDto,
  MealEntryQueryDto,
  MealEntryResponseDto,
  MealFilterDto,
  MealResponseDto,
  TodaySummaryResponseDto,
  UpdateMealDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Nutrition')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  // ============================================================================
  // MEALS CATALOG
  // ============================================================================

  @Get('meals')
  @ApiOperation({
    summary: 'List available meals from the catalog',
    description:
      'Returns the gym meal catalog, optionally filtered by meal type (BREAKFAST, LUNCH, DINNER, SNACK).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Catalog meals list',
    type: [MealResponseDto],
  })
  async getMeals(@Query() filter: MealFilterDto): Promise<MealResponseDto[]> {
    return this.nutritionService.getMeals(filter.type);
  }

  @Get('meals/:id')
  @ApiOperation({
    summary: 'Get details of a specific meal',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Meal details',
    type: MealResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Meal not found',
  })
  async getMealById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MealResponseDto> {
    return this.nutritionService.getMealById(id);
  }

  @Post('meals')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new meal in catalog (ADMIN only)',
    description:
      'Allows gym admins to add custom meals with macros to the catalog.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Meal created successfully',
    type: MealResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async createMeal(@Body() dto: CreateMealDto): Promise<MealResponseDto> {
    return this.nutritionService.createMeal(dto);
  }

  @Patch('meals/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update an existing meal in catalog (ADMIN only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Meal updated successfully',
    type: MealResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Meal not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async updateMeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealDto,
  ): Promise<MealResponseDto> {
    return this.nutritionService.updateMeal(id, dto);
  }

  @Delete('meals/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a meal from catalog (ADMIN only)',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Meal deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Meal not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async deleteMeal(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.nutritionService.deleteMeal(id);
  }

  // ============================================================================
  // USER MEAL ENTRIES
  // ============================================================================

  @Get('entries/today/summary')
  @ApiOperation({
    summary: "Get aggregated summary of today's meals for authenticated user",
    description:
      "Calculates totalKcal across today's entries and returns entries with meal entity details. Powers the 'Today's Meals' counter in iOS.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Today's total kcal and entries list",
    type: TodaySummaryResponseDto,
  })
  async getTodaySummary(
    @CurrentUser('userId') userId: string,
  ): Promise<TodaySummaryResponseDto> {
    return this.nutritionService.getTodaySummary(userId);
  }

  @Get('entries')
  @ApiOperation({
    summary: 'Get meal entries of the user for a specific date',
    description:
      'Returns the MealEntry records for the specified date including full Meal details. Groupable by type in the iOS app.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Meal entries for the requested date',
    type: [MealEntryResponseDto],
  })
  async getMealEntries(
    @CurrentUser('userId') userId: string,
    @Query() query: MealEntryQueryDto,
  ): Promise<MealEntryResponseDto[]> {
    return this.nutritionService.getMealEntriesByDate(userId, query.date);
  }

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record or update (upsert) a meal entry for the user',
    description:
      'Creates or updates a MealEntry by userId + mealId + date with consumed flag. Returns the entry with meal details.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Meal entry recorded successfully',
    type: MealEntryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Referenced meal not found',
  })
  async upsertMealEntry(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateMealEntryDto,
  ): Promise<MealEntryResponseDto> {
    return this.nutritionService.upsertMealEntry(userId, dto);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import {
  UpdateUserEquipmentPreferencesDto,
  UserEquipmentPreferencesResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users/me/equipment-preferences')
export class UsersEquipmentPreferencesController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @ApiOperation({
    summary: 'Get equipment preferences of authenticated user',
    description:
      'Returns the list of equipment IDs selected by the current user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User equipment preferences',
    type: UserEquipmentPreferencesResponseDto,
  })
  async getPreferences(
    @CurrentUser('userId') userId: string,
  ): Promise<UserEquipmentPreferencesResponseDto> {
    return this.equipmentService.getUserEquipmentPreferences(userId);
  }

  @Put()
  @ApiOperation({
    summary: 'Replace user equipment preferences',
    description:
      'Completely replaces the user equipment selection in a single atomic database transaction.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated user equipment preferences',
    type: UserEquipmentPreferencesResponseDto,
  })
  async replacePreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateUserEquipmentPreferencesDto,
  ): Promise<UserEquipmentPreferencesResponseDto> {
    return this.equipmentService.replaceUserEquipmentPreferences(
      userId,
      dto.equipmentIds,
    );
  }
}

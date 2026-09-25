import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
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
  EquipmentFilterDto,
  EquipmentResponseDto,
  UpdateEquipmentAvailabilityDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Equipment')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @ApiOperation({
    summary: 'List gym equipment currently available at this location',
    description:
      'Returns ONLY equipment marked as available at the gym (isAvailableAtGym=true). Regular users cannot see or select unavailable equipment.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available gym equipment',
    type: [EquipmentResponseDto],
  })
  async getAvailableEquipment(
    @Query() filter: EquipmentFilterDto,
  ): Promise<EquipmentResponseDto[]> {
    return this.equipmentService.getAvailableEquipment(filter.category);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Toggle or update gym equipment availability (ADMIN only)',
    description:
      'Gym equipment inventory management. If isAvailableAtGym is omitted in body, toggles current state.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated equipment entity',
    type: EquipmentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Equipment not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentAvailabilityDto,
  ): Promise<EquipmentResponseDto> {
    return this.equipmentService.updateAvailability(id, dto.isAvailableAtGym);
  }
}

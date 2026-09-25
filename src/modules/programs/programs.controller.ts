import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProgramsService } from './programs.service';
import { ProgramFilterDto } from './dto/program-filter.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramResponseDto } from './dto/program-response.dto';
import { ProgramDetailResponseDto } from './dto/program-detail-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Programs')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List programs with optional category filter',
    description: 'Accessible by any authenticated member or admin',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of programs',
    type: [ProgramResponseDto],
  })
  async getAll(
    @Query() filter: ProgramFilterDto,
  ): Promise<ProgramResponseDto[]> {
    return this.programsService.getAllPrograms(filter);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get program details including associated workouts',
    description: 'Accessible by any authenticated member or admin',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Program details with workouts',
    type: ProgramDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Program not found',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProgramDetailResponseDto> {
    return this.programsService.getProgramById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new program (Admin only)',
    description: 'Only users with the ADMIN role can create programs',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Program created successfully',
    type: ProgramResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async create(
    @Body() createProgramDto: CreateProgramDto,
  ): Promise<ProgramResponseDto> {
    return this.programsService.createProgram(createProgramDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update an existing program (Admin only)',
    description: 'Only users with the ADMIN role can update programs',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Program updated successfully',
    type: ProgramResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Program not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProgramDto: UpdateProgramDto,
  ): Promise<ProgramResponseDto> {
    return this.programsService.updateProgram(id, updateProgramDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a program (Admin only)',
    description: 'Only users with the ADMIN role can delete programs',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Program deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Program not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.programsService.deleteProgram(id);
  }
}

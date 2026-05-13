/**
 * src/application/mappers/UserMapper.ts
 *
 * Maps User domain entities to UserDTOs.
 *
 * Imports: domain + application.
 */

import type { User } from '@/domain/entities/User';

import type { UserDto } from '../dtos/UserDto';

export class UserMapper {
  static toDto(user: User): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

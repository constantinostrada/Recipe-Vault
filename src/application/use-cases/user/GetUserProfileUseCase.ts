/**
 * src/application/use-cases/user/GetUserProfileUseCase.ts
 *
 * Use Case: Retrieve a user's public profile.
 *
 * Imports: domain + application only.
 */

import { UserNotFoundError } from '@/domain/errors/DomainError';
import type { IUserRepository } from '@/domain/repositories/IUserRepository';

import type { GetUserInput, UserDto } from '../../dtos/UserDto';
import { UserMapper } from '../../mappers/UserMapper';

export class GetUserProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: GetUserInput): Promise<UserDto> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    return UserMapper.toDto(user);
  }
}

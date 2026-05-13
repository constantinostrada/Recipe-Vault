/**
 * src/application/use-cases/user/UpdateUserProfileUseCase.ts
 *
 * Use Case: Update a user's profile name and/or avatar image.
 *
 * Imports: domain + application only.
 */

import { UserNotFoundError } from '@/domain/errors/DomainError';
import type { IUserRepository } from '@/domain/repositories/IUserRepository';

import type { UpdateUserProfileInput, UserDto } from '../../dtos/UserDto';
import { UserMapper } from '../../mappers/UserMapper';

export class UpdateUserProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<UserDto> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    if (input.name !== undefined) {
      user.updateName(input.name);
    }

    if (input.image !== undefined) {
      user.updateImage(input.image);
    }

    await this.userRepository.update(user);

    return UserMapper.toDto(user);
  }
}

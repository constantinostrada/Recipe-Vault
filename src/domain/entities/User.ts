/**
 * src/domain/entities/User.ts
 *
 * The User entity.
 * Holds identity information and guards email/name invariants.
 *
 * Imports: domain only.
 */

import { Email } from '../value-objects/Email';
import { DomainError } from '../errors/DomainError';

export interface UserProps {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private readonly _id: string;
  private _name: string | null;
  private readonly _email: Email;
  private _passwordHash: string | null;
  private _image: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserProps) {
    this._id = props.id;
    this._name = props.name;
    this._email = Email.create(props.email);
    this._passwordHash = props.passwordHash;
    this._image = props.image;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this._id;
  }

  get name(): string | null {
    return this._name;
  }

  get email(): string {
    return this._email.value;
  }

  get passwordHash(): string | null {
    return this._passwordHash;
  }

  get image(): string | null {
    return this._image;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get displayName(): string {
    return this._name ?? this._email.localPart;
  }

  updateName(name: string): void {
    if (name.trim().length < 1 || name.trim().length > 100) {
      throw new DomainError('User name must be between 1 and 100 characters.');
    }
    this._name = name.trim();
    this.touch();
  }

  updateImage(imageUrl: string | null): void {
    this._image = imageUrl;
    this.touch();
  }

  hasPassword(): boolean {
    return this._passwordHash !== null;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  const mockUser = {
    id: 'user-1',
    email: 'admin@vms.com',
    password: '$2b$10$hashedpassword',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should return user without password for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('admin@vms.com', 'admin123');

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('admin@vms.com');
      expect(result.id).toBe('user-1');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser('no@user.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('admin@vms.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should return access_token and user info', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'admin@vms.com', password: 'admin123' });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('admin@vms.com');
      expect(result.user.id).toBe('user-1');
      expect(result.user.role).toBe('ADMIN');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'admin@vms.com',
        sub: 'user-1',
        role: 'ADMIN',
      });
    });
  });

  describe('register', () => {
    it('should hash password and create user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      usersService.create.mockResolvedValue(mockUser as any);

      const result = await service.register({
        email: 'new@vms.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-pw' }),
      );
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('validateToken', () => {
    it('should return decoded token for valid token', async () => {
      const decoded = { sub: 'user-1', email: 'admin@vms.com' };
      jwtService.verify.mockReturnValue(decoded);

      const result = await service.validateToken('valid-token');
      expect(result).toEqual(decoded);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.validateToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should call authService.login and return result', async () => {
      const loginResult = { access_token: 'token', user: { id: '1', email: 'a@b.com' } };
      authService.login.mockResolvedValue(loginResult as any);

      const result = await controller.login({ email: 'a@b.com', password: 'pass' });

      expect(authService.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
      expect(result).toEqual(loginResult);
    });
  });

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      const registerResult = { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B' };
      authService.register.mockResolvedValue(registerResult as any);

      const dto = { email: 'a@b.com', password: 'pass', firstName: 'A', lastName: 'B' };
      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(registerResult);
    });
  });

  describe('getProfile', () => {
    it('should return req.user', async () => {
      const req = { user: { id: '1', email: 'a@b.com', role: 'ADMIN' } };
      const result = await controller.getProfile(req);
      expect(result).toEqual(req.user);
    });
  });
});

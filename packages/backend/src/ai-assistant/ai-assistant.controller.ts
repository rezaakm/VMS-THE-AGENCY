import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AiAssistantService } from './ai-assistant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ai-assistant')
@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Stream a chat message to the AI assistant' })
  async chat(
    @Body() body: { messages: Array<{ role: string; content: string }>; context?: any },
    @Res() res: Response,
    @Req() req: Request,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const user = (req as any).user;
    const context = {
      ...body.context,
      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'User',
      userRole: user?.role || 'USER',
    };

    await this.aiAssistantService.chat(
      body.messages as any,
      context,
      res,
    );
  }
}

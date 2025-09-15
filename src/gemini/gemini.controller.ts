import { Controller, Post, Body } from '@nestjs/common';
import { GeminiService } from './gemini.service';

export class ChatRequestDto {
  message: string;
}

@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('chat')
  async chat(@Body() chatRequest: ChatRequestDto) {
    return this.geminiService.chatWithProducts(chatRequest.message);
  }
}
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { SearchService } from './search.service';
@Controller('search')
@UseGuards(JwtGuard)
export class SearchController {
  constructor(private s: SearchService) {}
  @Get() run(@Req() req:any,@Query('q') q='',@Query('sort') sort='relevance'){return this.s.run(req.user,q,sort);}
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class SearchService {
  constructor(private db: PrismaService) {}
  parse(q:string){const s=q.trim();const f:any={};let m;if(m=s.match(/nom (?:contient|contenant) ["']?([^"']+)["']?/i))f.nameContains=m[1].trim();if(m=s.match(/(?:commence|début) par ["']?([^"']+)["']?/i))f.nameStartsWith=m[1].trim();if(m=s.match(/(?:se termine|finit) par ["']?([^"']+)["']?/i))f.nameEndsWith=m[1].trim();if(m=s.match(/\b(pdf|docx?|xlsx?|pptx?|zip|jpg|jpeg|png|tiff?|dwg|dxf|txt|csv)\b/i))f.extension=m[1].toLowerCase();if(m=s.match(/(?:plus de|supérieur à)\s*(\d+)\s*(ko|mo|go)/i)){const n=Number(m[1]),u=m[2].toLowerCase();f.minBytes=n*(u==='go'?1073741824:u==='mo'?1048576:1024);}return f;}
  async run(user:any,q:string,sort='relevance'){
    const tenantId=user.tenantId; const f=this.parse(q); const where:any={tenantId,deletedAt:null,status:'ACTIVE'};
    if(user.role!=='TENANT_ADMIN') where.folder={OR:[{visibility:'COMPANY'},{createdById:user.sub},{userAccesses:{some:{userId:user.sub}}},{groupAccesses:{some:{group:{members:{some:{userId:user.sub}}}}}}]};
    if(f.extension)where.extension=f.extension;if(f.minBytes)where.sizeBytes={gte:BigInt(f.minBytes)};const ors:any[]=[];
    if(f.nameContains)ors.push({name:{contains:f.nameContains,mode:'insensitive'}});if(f.nameStartsWith)ors.push({name:{startsWith:f.nameStartsWith,mode:'insensitive'}});if(f.nameEndsWith)ors.push({name:{endsWith:f.nameEndsWith,mode:'insensitive'}});if(!ors.length&&q)ors.push({name:{contains:q,mode:'insensitive'}},{extractedText:{contains:q,mode:'insensitive'}});if(ors.length)where.OR=ors;
    const docs=await this.db.document.findMany({where,take:100,orderBy:sort==='newest'?{createdAt:'desc'}:{name:'asc'},include:{folder:{select:{name:true}},createdBy:{select:{name:true}}}});return {query:q,interpretedFilters:f,documents:docs};
  }
}

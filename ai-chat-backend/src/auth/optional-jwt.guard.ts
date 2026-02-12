import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/** Не выбрасывает ошибку при отсутствии/невалидном JWT — req.user будет undefined */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser): TUser | undefined {
    if (err) return undefined;
    return user;
  }
}

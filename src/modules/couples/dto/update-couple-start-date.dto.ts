import { IsDateString } from 'class-validator';

export class UpdateCoupleStartDateDto {
  @IsDateString({ strict: true })
  startDate: string;
}

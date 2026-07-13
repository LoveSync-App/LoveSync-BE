/* eslint-disable @typescript-eslint/no-wrapper-object-types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Couple, CoupleDocument } from './schemas/couple.schema';
import { CoupleStatus } from './enum/couple-status.enum';
import {
  CouplePeriod,
  CouplePeriodDocument,
} from './schemas/couple_period.schema';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import { NotificationService } from '../notifications/notification_service';
import { Device, DeviceDocument } from '../device/schema/device.schema';
import { InvitationStatus } from './enum/invitation-status.enum';
import {
  CalendarEvent,
  CalendarEventDocument,
} from '../calendar/schemas/calendar-event.schema';
import { CalendarEventType } from '../calendar/enum/calendar-event-type.enum';
import { CalendarRecurrence } from '../calendar/enum/calendar-recurrence.enum';
import { getNextReminderSchedule } from '../calendar/calendar-date.util';

@Injectable()
export class CoupleService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(CouplePeriod.name)
    private readonly couplePeriodModel: Model<CouplePeriodDocument>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(CalendarEvent.name)
    private readonly calendarEventModel: Model<CalendarEventDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly notificationService: NotificationService,
  ) {}

  public async getMyCoupleCode(
    userId: string,
  ): Promise<{ code: string | null }> {
    const user = await this.userModel.findById(userId).select('code');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.code) {
      user.code = Math.random().toString(36).substring(2, 10);
      while (await this.userModel.findOne({ code: user.code })) {
        user.code = Math.random().toString(36).substring(2, 10);
      }
      await user.save();
    }
    return { code: user.code || null };
  }

  public async linkCouple(
    userId: string,
    code: string,
  ): Promise<Invitation | null> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const partner = await this.userModel.findOne({ code });
    if (!partner) throw new NotFoundException('Partner not found');

    if (user._id.toString() === partner._id.toString()) {
      throw new BadRequestException('You cannot link with yourself');
    }

    const hasActiveCouple = await this.coupleModel.findOne({
      $or: [
        { user_1: user._id },
        { user_2: user._id },
        { user_1: partner._id },
        { user_2: partner._id },
      ],
      status: CoupleStatus.ACTIVE,
    });
    if (hasActiveCouple) {
      throw new ConflictException(
        'Either you or your partner is already in an active couple',
      );
    }

    let invitation = await this.invitationModel.findOne({
      sender: user._id,
      receiver: partner._id,
      status: InvitationStatus.PENDING,
    });

    if (!invitation) {
      const reverseInvite = await this.invitationModel.findOne({
        sender: partner._id,
        receiver: user._id,
        status: InvitationStatus.PENDING,
      });
      if (reverseInvite) {
        throw new ConflictException(
          'This partner has already sent an invitation to you',
        );
      }

      invitation = new this.invitationModel({
        sender: user._id,
        receiver: partner._id,
        status: InvitationStatus.PENDING,
      });
      await invitation.save();
    }

    this.deviceModel
      .findOne({ user: partner._id })
      .then((device) => {
        if (device && device.token) {
          this.notificationService.sendNotification(
            device.token,
            'Ghép cặp đôi',
            `${user.name} đã gửi lời mời ghép cặp với bạn!`,
          );
        }
      })
      .catch((err) => console.error('Noti error:', err));

    return invitation;
  }

  public async getInvitationByIdAndStatus(
    userId: string,
    status: InvitationStatus,
  ) {
    const objectUserId = new Types.ObjectId(userId);
    const invitations = await this.invitationModel
      .find({
        receiver: objectUserId,
        status: status,
      })
      .populate('sender', 'name avatar');
    return invitations.map((invitation) => {
      const sender = invitation.sender as unknown as User;
      return {
        id: invitation._id.toString(),
        partnerName: sender.name,
        partnerAvatar: sender.avatar,
      };
    });
  }

  public async rejectInvitation(invitationId: string, userId: string) {
    const invitation = await this.invitationModel.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.receiver.toString() !== userId) {
      throw new ConflictException(
        'You are not the receiver of this invitation',
      );
    }
    invitation.status = InvitationStatus.REJECTED;
    await invitation.save();
    return invitation;
  }

  public async acceptInvitation(invitationId: string, userId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const invitation = await this.invitationModel
        .findById(new Types.ObjectId(invitationId))
        .session(session);
      if (!invitation) throw new NotFoundException('Invitation not found');
      if (invitation.receiver.toString() !== userId) {
        throw new ConflictException(
          'You are not the receiver of this invitation',
        );
      }
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('Invitation is no longer pending');
      }

      const senderId = invitation.sender;
      const receiverId = invitation.receiver;

      const existingCouple = await this.coupleModel
        .findOne({
          $or: [
            { user_1: senderId },
            { user_2: senderId },
            { user_1: receiverId },
            { user_2: receiverId },
          ],
          status: CoupleStatus.ACTIVE,
        })
        .session(session);

      if (existingCouple) {
        invitation.status = InvitationStatus.REJECTED;
        await invitation.save({ session });
        throw new ConflictException(
          'Either you or your partner is already in an active couple',
        );
      }

      invitation.status = InvitationStatus.ACCEPTED;
      await invitation.save({ session });

      let couple = await this.coupleModel
        .findOne({
          $or: [
            { user_1: senderId, user_2: receiverId },
            { user_1: receiverId, user_2: senderId },
          ],
        })
        .session(session);

      if (couple) {
        couple.status = CoupleStatus.ACTIVE;
        await couple.save({ session });
      } else {
        couple = new this.coupleModel({
          user_1: senderId,
          user_2: receiverId,
          status: CoupleStatus.ACTIVE,
        });
        await couple.save({ session });
      }

      const period = new this.couplePeriodModel({
        start_date: new Date(),
        end_date: new Date(),
        couple: couple._id,
        status: CoupleStatus.ACTIVE,
      });
      await period.save({ session });

      await this.syncAnniversaryEvent(
        couple._id,
        receiverId,
        period.start_date,
        session,
      );

      await this.invitationModel
        .updateMany(
          {
            _id: { $ne: invitation._id },
            status: InvitationStatus.PENDING,
            $or: [
              { sender: senderId },
              { receiver: senderId },
              { sender: receiverId },
              { receiver: receiverId },
            ],
          },
          { $set: { status: InvitationStatus.REJECTED } },
        )
        .session(session);

      await session.commitTransaction();
      return couple;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  public async checkCoupleCode(code: string): Promise<Object | null> {
    const partner = await this.userModel.findOne({ code: code });
    if (!partner) {
      throw new NotFoundException('Partner with the provided code not found');
    }

    return {
      partnerId: partner._id,
      partnerName: partner.name,
      partnerAvatar: partner.avatar,
      partnerEmail: partner.email,
      partnerPhone: partner.phone,
    };
  }

  public async getLoveDays(
    userId: string,
  ): Promise<{ loveDays: number; startDate: Date } | null> {
    // throw new NotFoundException('Not implemented yet');
    const userObjectId = new Types.ObjectId(userId);
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
      status: CoupleStatus.ACTIVE,
    });

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    const periods = await this.couplePeriodModel.find({ couple: couple._id });

    let loveDays = 0;
    const today = new Date();

    for (const period of periods) {
      const startDate = new Date(period.start_date);
      const endDate =
        period.status === CoupleStatus.BROKEN_UP
          ? new Date(period.end_date)
          : today;
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      loveDays += diffDays;
    }

    const activePeriod = periods.find(
      (period) => period.status === CoupleStatus.ACTIVE,
    );
    if (!activePeriod) {
      throw new NotFoundException('Active couple period not found');
    }

    return { loveDays, startDate: activePeriod.start_date };
  }

  public async updateStartDate(
    userId: string,
    startDateValue: string,
  ): Promise<{ loveDays: number; startDate: Date }> {
    const startDate = new Date(startDateValue);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date');
    }

    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const selectedUtc = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    );
    if (selectedUtc > todayUtc) {
      throw new BadRequestException('Start date cannot be in the future');
    }

    const userObjectId = new Types.ObjectId(userId);
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    const period = await this.couplePeriodModel.findOne({
      couple: couple._id,
      status: CoupleStatus.ACTIVE,
    });
    if (!period) {
      throw new NotFoundException('Active couple period not found');
    }

    period.start_date = new Date(selectedUtc);
    period.end_date = new Date();
    await period.save();

    await this.syncAnniversaryEvent(
      couple._id,
      userObjectId,
      period.start_date,
    );

    const result = await this.getLoveDays(userId);
    if (!result) {
      throw new NotFoundException('Couple period not found');
    }
    return result;
  }

  private async syncAnniversaryEvent(
    coupleId: Types.ObjectId,
    createdBy: Types.ObjectId,
    startDate: Date,
    session?: ClientSession,
  ): Promise<void> {
    const recurrence = CalendarRecurrence.YEARLY;
    const reminderMinutesBefore = 1440;
    const schedule = getNextReminderSchedule(
      startDate,
      recurrence,
      reminderMinutesBefore,
    );

    await this.calendarEventModel.findOneAndUpdate(
      { couple: coupleId, systemKey: 'COUPLE_ANNIVERSARY' },
      {
        $set: {
          type: CalendarEventType.IMPORTANT_DATE,
          title: 'Kỷ niệm ngày yêu nhau',
          description: 'Ngày kỷ niệm được đồng bộ từ ngày bắt đầu yêu nhau.',
          startsAt: startDate,
          recurrence,
          reminderEnabled: true,
          reminderMinutesBefore,
          nextReminderAt: schedule?.reminderAt,
          nextOccurrenceAt: schedule?.occurrenceAt,
        },
        $unset: {
          lastReminderOccurrenceAt: 1,
          reminderClaimedAt: 1,
          lastReminderSentAt: 1,
        },
        $setOnInsert: {
          couple: coupleId,
          createdBy,
          systemKey: 'COUPLE_ANNIVERSARY',
        },
      },
      { upsert: true, new: true, session },
    );
  }

  public async unlinkCouple(userId: string): Promise<Couple | null> {
    // throw new NotFoundException('Not implemented yet');
    const userObjectId = new Types.ObjectId(userId);
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
      status: CoupleStatus.ACTIVE,
    });

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    const period = await this.couplePeriodModel.findOne({
      couple: couple._id,
      status: CoupleStatus.ACTIVE,
    });
    if (period) {
      period.end_date = new Date();
      period.status = CoupleStatus.BROKEN_UP;
      await period.save();

      couple.status = CoupleStatus.BROKEN_UP;
      await couple.save();
    } else {
      throw new NotFoundException('Couple period not found');
    }
    return couple;
  }

  public async getMyCouple(userId: string): Promise<Object | null> {
    // throw new NotFoundException('Not implemented yet');
    const userObjectId = new Types.ObjectId(userId);

    const couple = await this.coupleModel
      .findOne({
        $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
        status: CoupleStatus.ACTIVE,
      })
      .populate('user_1', 'name email avatar')
      .populate('user_2', 'name email avatar');

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    const user: any = couple.user_1._id.equals(userObjectId)
      ? couple.user_1
      : couple.user_2;
    const partner: any = couple.user_1._id.equals(userObjectId)
      ? couple.user_2
      : couple.user_1;

    return {
      coupleId: couple._id,
      userId: user._id,
      userName: user.name,
      userAvatar: user.avatar,
      userEmail: user.email,
      userPhone: user.phone,
      partnerId: partner._id,
      partnerName: partner?.name,
      partnerAvatar: partner.avatar,
      partnerEmail: partner.email,
      partnerPhone: partner.phone,
    };
  }
}

/**
 * src/modules/approvals/controllers/approvals.controller.ts
 *
 * REST endpoints for approval processing
 * SOLID:
 * - SRP: Only routing and parameter handling
 * - DIP: Depends on ApprovalsService abstraction
 */

import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from '../services/approvals.service';
// import { HermesTenantGuard } from '../../hermes/guards/hermes-tenant.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import type {
    StratifiedApprovalsResponse,
    ApprovalFeedback,
} from '../../../shared/types/approvals.types';

/**
 * ApprovalsController
 * Provides approvals REST endpoints
 * SOLID: SRP - Only routing and validation
 */
@ApiTags('Approvals')
@ApiBearerAuth()
@Controller({ path: 'approvals', version: '1' })
export class ApprovalsController {
    constructor(private readonly approvalsService: ApprovalsService) { }

    /**
     * Get stratified approvals
     * SOLID: SRP - Only routing
     *
     * @param user - Current user from JWT
     * @param status - Filter by status (PENDING, APPROVED, REJECTED)
     * @returns Stratified approvals response
     */
    @Get('stratified')
    @ApiOperation({
        summary: 'Get stratified approvals',
        description:
            'Returns approvals stratified into critical and routine, with AI recommendations.',
    })
    @ApiResponse({
        status: 200,
        description: 'Stratified approvals successfully retrieved',
    })
    @ApiResponse({ status: 403, description: 'Unauthorized' })
    async getStratified(
        @CurrentUser() user: JwtPayload,
        @Query('status') status?: string
    ): Promise<StratifiedApprovalsResponse> {
        return this.approvalsService.getStratifiedApprovals(
            user.tenantId!,
            status || 'PENDING'
        );
    }

    /**
     * Submit feedback for approval decision
     * SOLID: SRP - Only routing and validation
     *
     * @param user - Current user from JWT
     * @param feedback - Feedback data
     */
    @Post('feedback')
    @ApiOperation({
        summary: 'Submit approval feedback',
        description:
            'Records user feedback when their decision differs from AI recommendation. Used for model learning.',
    })
    @ApiResponse({
        status: 201,
        description: 'Feedback successfully submitted',
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 403, description: 'Unauthorized' })
    async submitFeedback(
        @CurrentUser() user: JwtPayload,
        @Body() feedback: ApprovalFeedback
    ): Promise<{ success: boolean; message: string }> {
        await this.approvalsService.submitFeedback(user.tenantId!, feedback);
        return {
            success: true,
            message: 'Feedback submitted successfully',
        };
    }

    /**
     * Approve an approval request
     * SOLID: SRP - Only routing
     *
     * @param user - Current user from JWT
     * @param approvalId - Approval ID
     */
    @Post(':approvalId/approve')
    @ApiOperation({
        summary: 'Approve a request',
        description: 'Marks an approval request as approved.',
    })
    @ApiResponse({
        status: 200,
        description: 'Request successfully approved',
    })
    @ApiResponse({ status: 404, description: 'Request not found' })
    async approve(
        @CurrentUser() user: JwtPayload,
        @Param('approvalId') approvalId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.approvalsService.approveRequest(user.tenantId!, approvalId);
        return {
            success: true,
            message: 'Request approved successfully',
        };
    }

    /**
     * Reject an approval request
     * SOLID: SRP - Only routing
     *
     * @param user - Current user from JWT
     * @param approvalId - Approval ID
     */
    @Post(':approvalId/reject')
    @ApiOperation({
        summary: 'Reject a request',
        description: 'Marks an approval request as rejected.',
    })
    @ApiResponse({
        status: 200,
        description: 'Request successfully rejected',
    })
    @ApiResponse({ status: 404, description: 'Request not found' })
    async reject(
        @CurrentUser() user: JwtPayload,
        @Param('approvalId') approvalId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.approvalsService.rejectRequest(user.tenantId!, approvalId);
        return {
            success: true,
            message: 'Request rejected successfully',
        };
    }
}

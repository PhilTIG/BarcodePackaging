# QA Reporting Dashboard - Product Requirements Document

## Executive Summary

The QA Reporting Dashboard extends our existing CheckCount functionality to provide comprehensive quality assurance analytics and insights. This system will offer both a summary QA panel in the main dashboard and a dedicated QA dashboard for detailed analysis of verification activities, worker performance, and extra items discovered during CheckCount processes.

## Business Objectives

- **Quality Assurance Visibility**: Provide managers and supervisors with clear insights into verification activities
- **Worker Performance Monitoring**: Track and analyze worker QA performance metrics
- **Discrepancy Analysis**: Identify patterns in quality issues and resolution effectiveness
- **Operational Efficiency**: Optimize CheckCount processes through data-driven insights
- **Compliance Support**: Maintain detailed audit trails for quality assurance activities

## User Personas

### Primary Users
- **Managers**: Full access to all QA analytics across jobs and workers
- **Supervisors**: Job-specific QA insights and worker performance monitoring
- **System Administrators**: Overall system health and performance analytics

### Use Cases
1. **Daily QA Review**: Managers review overnight CheckCount activities and address discrepancies
2. **Worker Performance Assessment**: Supervisors analyze individual worker QA accuracy and efficiency
3. **Quality Trend Analysis**: Identify recurring issues with specific products or suppliers
4. **Process Optimization**: Use data insights to improve CheckCount workflows

## Technical Architecture

### Data Sources
- **CheckCount Sessions**: `check_sessions` table data
- **CheckCount Events**: `check_events` table for detailed scan analytics
- **CheckCount Results**: `check_results` table for resolution tracking
- **Extra Items**: `scanEvents` table with `isExtraItem=true`
- **Job Progress**: Existing job progress endpoints
- **Worker Performance**: Cross-referenced with existing scan performance data

### API Extensions
- New QA-specific analytics endpoints
- Enhanced existing endpoints with QA metrics
- Real-time WebSocket updates for live dashboard updates

### Frontend Architecture
- New QA summary panel component for main dashboard
- Dedicated QA dashboard page with job-specific routing
- Reusable QA metric components
- Integration with existing theme system

## Functional Requirements

### 1. Main Dashboard QA Summary Panel

#### Core Features
- **Active Jobs Only**: Display QA metrics for currently active jobs (no archived data)
- **7-Day Activity Window**: Show recent QA activities from the last 7 days
- **Clickable Job Navigation**: Direct navigation to dedicated QA dashboard for selected job

#### Key Metrics Display
- **Verification Rate**: Percentage of boxes that have completed CheckCount verification
- **Accuracy Score**: Overall accuracy rate across all CheckCount sessions
- **Worker QA Performance**: Summary of worker verification activities and accuracy
- **Recent Activity Feed**: Latest CheckCount activities with outcomes and timestamps

#### Visual Design
- Compact card layout fitting existing dashboard grid
- Color-coded status indicators (green/orange/red)
- Quick-scan metrics with prominent numbers
- Responsive design for tablet viewing

### 2. Dedicated QA Dashboard

#### Navigation & Job Selection
- **Direct Job Access**: When accessed from main dashboard, pre-select specific job
- **Job Selector Dropdown**: Switch between active jobs with quick stats preview
- **Breadcrumb Navigation**: Clear path back to main dashboard

#### Overview Metrics Section
- **Total Boxes Verified vs Total Boxes**: Progress bar with percentage completion
- **Overall Accuracy Percentage**: Weighted accuracy across all verification sessions
- **Total Discrepancies Found/Resolved**: Count of issues discovered and resolution rate
- **Extra Items Count**: Total extra items discovered (no value calculation required)
- **Average Verification Time per Box**: Efficiency metric for process optimization

#### Detailed Analytics Sections

##### A) Box Verification Analysis
- **Verification Status Grid**: Visual representation of box verification states
- **Discrepancy Overview**: Summary of discrepancy types and frequencies
- **Resolution Tracking**: Breakdown of corrections applied vs rejected
- **Box-Level Details**: Drill-down to individual box CheckCount results

##### B) Worker Performance Metrics
- **Individual Worker Cards**: Worker-specific accuracy rates and box counts
- **Performance Comparison**: Relative performance visualization
- **Activity Timeline**: Worker CheckCount activities over time
- **Accuracy Trends**: Worker improvement or decline patterns

##### C) Discrepancy Intelligence
- **Product-Level Analysis**: Which products have highest discrepancy rates
- **Discrepancy Categories**: Breakdown by shortage, excess, and other types
- **Resolution Patterns**: Analysis of how discrepancies are typically resolved
- **Time-Based Patterns**: When discrepancies are most commonly found

##### D) Extra Items Analysis
- **Extra Items Timeline**: When extra items are discovered during CheckCount
- **Product Categories**: Types of products appearing as extras
- **Worker Attribution**: Which workers discover extra items most frequently
- **Frequency Analysis**: Most common extra item patterns

## Technical Requirements

### Performance Requirements
- **Page Load Time**: QA dashboard loads within 3 seconds
- **Real-time Updates**: WebSocket integration for live metric updates
- **Data Refresh**: 30-second polling for dashboard metrics
- **Mobile Responsive**: Tablet-optimized layout for floor management

### Data Requirements
- **7-Day Rolling Window**: Maintain 7 days of hot data for dashboard metrics
- **Historical Aggregation**: Pre-computed daily summaries for performance
- **Real-time Calculation**: Live metrics for active sessions
- **Data Integrity**: Consistent metrics across all dashboard components

### Security Requirements
- **Role-Based Access**: Manager/supervisor access controls
- **Job-Level Permissions**: Users only see jobs they have access to
- **Data Privacy**: Worker performance data appropriately protected
- **Audit Trail**: Track QA dashboard access and actions

## Implementation Plan

### Phase 1: Backend Infrastructure (Week 1-2)
#### Database & Analytics Layer
- [ ] Create QA analytics database views for performance optimization
- [ ] Implement new QA-specific API endpoints
- [ ] Add QA metrics to existing job progress endpoints
- [ ] Create background job for pre-computing QA summaries
- [ ] Add database indexes for QA query optimization

#### API Development
- [ ] `/api/qa/summary` - Active jobs QA summary for main dashboard
- [ ] `/api/qa/jobs/:id/overview` - Detailed job QA metrics
- [ ] `/api/qa/jobs/:id/boxes` - Box-level verification analysis
- [ ] `/api/qa/jobs/:id/workers` - Worker performance for specific job
- [ ] `/api/qa/jobs/:id/discrepancies` - Detailed discrepancy analysis
- [ ] `/api/qa/jobs/:id/extra-items` - Extra items analysis for job

### Phase 2: Main Dashboard Integration (Week 2-3)
#### QA Summary Panel Component
- [ ] Create `QASummaryPanel` component with metrics display
- [ ] Implement real-time data fetching with React Query
- [ ] Add click navigation to dedicated QA dashboard
- [ ] Integrate with existing dashboard grid layout
- [ ] Style with current theme system and responsive design

#### Dashboard Integration
- [ ] Add QA summary panel to main dashboard layout
- [ ] Implement WebSocket updates for real-time metrics
- [ ] Add loading states and error handling
- [ ] Test responsive design on tablets and mobile

### Phase 3: Dedicated QA Dashboard (Week 3-4)
#### Core Dashboard Structure
- [ ] Create dedicated QA dashboard page at `/qa-dashboard/:jobId?`
- [ ] Implement job selector with quick stats preview
- [ ] Build overview metrics section with key KPIs
- [ ] Add navigation breadcrumbs and route management

#### Analytics Components
- [ ] `BoxVerificationGrid` - Visual box verification status
- [ ] `WorkerPerformanceCards` - Individual worker metrics
- [ ] `DiscrepancyAnalysis` - Product and category insights
- [ ] `ExtraItemsAnalysis` - Extra items discovery patterns
- [ ] `QATimeline` - Chronological activity view

#### Data Visualization
- [ ] Integrate Recharts for metrics visualization
- [ ] Create reusable chart components for QA metrics
- [ ] Implement color-coded status indicators
- [ ] Add interactive drill-down capabilities

### Phase 4: Advanced Features (Week 4-5)
#### Real-time Integration
- [ ] WebSocket integration for live dashboard updates
- [ ] Real-time notifications for significant QA events
- [ ] Auto-refresh logic for stale data detection
- [ ] Performance optimization for large datasets

#### Enhanced Analytics
- [ ] Time-based filtering (today, this week, custom range)
- [ ] Export functionality for QA reports
- [ ] Advanced filtering and search capabilities
- [ ] Predictive insights for quality trends

#### User Experience Enhancements
- [ ] Keyboard shortcuts for power users
- [ ] Customizable dashboard layouts
- [ ] Saved filter preferences
- [ ] Help tooltips and guided tours

## Success Criteria

### Functional Success Metrics
- [x] Managers can view QA summary for all active jobs
- [x] Job-specific QA analytics accessible via clickable navigation
- [x] Worker performance metrics accurately calculated and displayed
- [x] Real-time updates reflect CheckCount activities immediately
- [x] Dashboard responsive on tablets for floor management use

### Technical Success Metrics
- [x] Page load times under 3 seconds for QA dashboard
- [x] Real-time updates delivered within 5 seconds of CheckCount completion
- [x] Mobile responsive design tested on tablets
- [x] No performance degradation on existing dashboard
- [x] WebSocket integration maintains connection stability

### Business Success Metrics
- [x] Increased visibility into quality assurance activities
- [x] Improved worker accountability through performance tracking
- [x] Faster identification and resolution of quality issues
- [x] Data-driven insights for process optimization
- [x] Enhanced audit trail for compliance requirements

## Data Model Extensions

### QA Analytics Views
```sql
-- QA Summary View for active jobs
CREATE VIEW qa_job_summary AS
SELECT 
  j.id as job_id,
  j.name as job_name,
  COUNT(DISTINCT br.id) as total_boxes,
  COUNT(DISTINCT cs.id) as verified_boxes,
  ROUND(AVG(CASE WHEN cs.discrepancies_found = 0 THEN 100 ELSE 0 END), 2) as accuracy_percentage,
  COUNT(DISTINCT CASE WHEN cs.discrepancies_found > 0 THEN cs.id END) as discrepancies_found,
  COUNT(DISTINCT CASE WHEN cs.corrections_applied = true THEN cs.id END) as discrepancies_resolved
FROM jobs j
LEFT JOIN box_requirements br ON j.id = br.job_id
LEFT JOIN check_sessions cs ON j.id = cs.job_id AND cs.status = 'completed'
WHERE j.status = 'active'
GROUP BY j.id, j.name;
```

### Performance Optimization
- Materialized views for heavy analytics queries
- Indexed columns for QA-specific filtering
- Cached results for frequently accessed metrics
- Background aggregation jobs for historical data

## Integration Points

### Existing System Integration
- **WebSocket System**: Extend existing `check_count_update` messages
- **Job Progress API**: Enhance with QA-specific metrics
- **User Permissions**: Integrate with existing role-based access
- **Theme System**: Use current color scheme and responsive framework

### Future Extensibility
- **Export Integration**: Framework for PDF/CSV report generation
- **Notification System**: Foundation for QA alerting
- **API Extensions**: Structured for additional analytics endpoints
- **Mobile App Ready**: API design supports future mobile applications

## Risk Assessment & Mitigation

### Technical Risks
- **Performance Impact**: Mitigation through materialized views and caching
- **Data Consistency**: Ensure real-time updates maintain data integrity
- **Scalability**: Design for growth in CheckCount usage
- **Browser Compatibility**: Test across all supported browsers

### Business Risks
- **User Adoption**: Provide clear value proposition and training
- **Data Privacy**: Ensure worker performance data is appropriately protected
- **Compliance**: Maintain audit trails for quality assurance requirements
- **Change Management**: Gradual rollout with feedback collection

## Conclusion

The QA Reporting Dashboard provides essential visibility into CheckCount verification activities, enabling data-driven quality assurance decisions. The phased implementation approach ensures minimal disruption to existing workflows while delivering immediate value through enhanced QA insights and worker performance tracking.

This system positions the warehouse management platform as a comprehensive quality assurance solution, supporting both operational efficiency and compliance requirements through detailed analytics and real-time monitoring capabilities.
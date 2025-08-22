
-- Fix worker assignments for current job
-- Worker 2 (assigned first at 06:30:34) should be index 0 with ascending pattern
-- Worker 1 (assigned second at 06:31:18) should be index 1 with descending pattern

UPDATE job_assignments 
SET worker_index = 0, allocation_pattern = 'ascending'
WHERE assigned_at = '2025-08-22T06:30:34.210Z';

UPDATE job_assignments 
SET worker_index = 1, allocation_pattern = 'descending' 
WHERE assigned_at = '2025-08-22T06:31:18.597Z';

-- Verify the changes
SELECT 
  users.name as worker_name,
  job_assignments.worker_index,
  job_assignments.allocation_pattern,
  job_assignments.assigned_at
FROM job_assignments 
JOIN users ON job_assignments.user_id = users.id
WHERE job_assignments.is_active = true
ORDER BY job_assignments.assigned_at;

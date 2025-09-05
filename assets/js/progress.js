import { authManager } from './auth.js';
import { getUserStats, getAttemptsForUser } from './attempts.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!authManager.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    await loadProgressData();
});

async function loadProgressData() {
    try {
        const [stats, attempts] = await Promise.all([
            getUserStats(),
            getAttemptsForUser({ limitCount: 50 })
        ]);

        const streak = calculateCurrentStreak(attempts);

        // Update overall stats
        document.getElementById('total-attempts').textContent = stats.totalAttempts;
        document.getElementById('overall-average').textContent = `${stats.averageScore}%`;
        const hours = Math.floor(stats.totalTimeMinutes / 60);
        const minutes = stats.totalTimeMinutes % 60;
        document.getElementById('total-time').textContent =
            hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        document.getElementById('current-streak').textContent = streak;

        renderSubjectProgress(stats.subjectStats);
        renderRecentActivity(attempts);
        renderAchievements(stats, attempts, streak);
    } catch (err) {
        console.error('Error loading progress:', err);
        toast.error('Failed to load progress');
    }
}

function renderSubjectProgress(subjectStats) {
    const container = document.getElementById('subject-progress');
    const subjectIcons = {
        Biology: '🧬',
        Physics: '⚛️',
        Chemistry: '⚗️',
        Geology: '🌍',
        English: '📖'
    };

    container.innerHTML = Object.entries(subjectStats).map(([subject, data]) => {
        const percentage = data.averageScore;
        const color = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
        return `
            <div class="subject-progress-item">
                <div class="subject-progress-header">
                    <span class="subject-progress-icon">${subjectIcons[subject] || '📚'}</span>
                    <div class="subject-progress-info">
                        <h4>${subject}</h4>
                        <p>${data.attempts} attempt${data.attempts !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="subject-progress-score">${percentage}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background-color: ${color}"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentActivity(attempts) {
    const container = document.getElementById('activity-timeline');
    const passages = JSON.parse(localStorage.getItem('studysphere.passages.v1') || '[]');

    if (attempts.length === 0) {
        container.innerHTML = `
            <div class="empty-activity">
                <div class="empty-icon">📊</div>
                <p>No quiz attempts yet</p>
                <a href="subjects.html" class="btn btn-primary btn-sm">Start Your First Quiz</a>
            </div>
        `;
        return;
    }

    container.innerHTML = attempts.slice(0, 10).map(attempt => {
        const passage = passages.find(p => p.id === attempt.passageId);
        const percentage = attempt.score;
        const scoreColor = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
        const timeAgo = getTimeAgo(attempt.attemptedAt);

        return `
            <div class="activity-item">
                <div class="activity-icon" style="background-color: ${scoreColor}">
                    ${percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '📚'}
                </div>
                <div class="activity-content">
                    <h4>${passage ? passage.title : 'Unknown Passage'}</h4>
                    <p>Score: ${percentage}%</p>
                    <span class="activity-time">${timeAgo}</span>
                </div>
                <div class="activity-score" style="color: ${scoreColor}">
                    ${percentage}%
                </div>
            </div>
        `;
    }).join('');
}

function renderAchievements(stats, attempts, streak) {
    const container = document.getElementById('achievements-grid');
    const achievements = calculateAchievements(stats, attempts, streak);

    container.innerHTML = achievements.map(a => `
        <div class="achievement-item ${a.unlocked ? 'unlocked' : 'locked'}">
            <div class="achievement-icon">${a.icon}</div>
            <div class="achievement-content">
                <h4>${a.title}</h4>
                <p>${a.description}</p>
                ${a.unlocked ? '<span class="achievement-date">Unlocked</span>' : `<span class="achievement-progress">${a.progress}</span>`}
            </div>
        </div>
    `).join('');
}

function calculateAchievements(stats, attempts, streak) {
    return [
        {
            id: 'first_quiz',
            title: 'Getting Started',
            description: 'Complete your first quiz',
            icon: '🎯',
            unlocked: stats.totalAttempts >= 1,
            progress: `${Math.min(stats.totalAttempts, 1)}/1 quizzes`
        },
        {
            id: 'quiz_master',
            title: 'Quiz Master',
            description: 'Complete 10 quizzes',
            icon: '🏆',
            unlocked: stats.totalAttempts >= 10,
            progress: `${Math.min(stats.totalAttempts, 10)}/10 quizzes`
        },
        {
            id: 'perfect_score',
            title: 'Perfect Score',
            description: 'Get 100% on any quiz',
            icon: '⭐',
            unlocked: attempts.some(a => a.score === 100),
            progress: 'Get 100% on a quiz'
        },
        {
            id: 'study_streak',
            title: 'Consistent Learner',
            description: 'Study for 7 days in a row',
            icon: '🔥',
            unlocked: streak >= 7,
            progress: `${Math.min(streak, 7)}/7 days`
        },
        {
            id: 'all_subjects',
            title: 'Well Rounded',
            description: 'Complete quizzes in all 5 subjects',
            icon: '🌟',
            unlocked: Object.values(stats.subjectStats).filter(s => s.attempts > 0).length >= 5,
            progress: `${Object.values(stats.subjectStats).filter(s => s.attempts > 0).length}/5 subjects`
        },
        {
            id: 'speed_demon',
            title: 'Speed Demon',
            description: 'Complete a quiz in under 5 minutes',
            icon: '⚡',
            unlocked: attempts.some(a => a.timeTakenSec < 300),
            progress: 'Complete a quiz quickly'
        }
    ];
}

function calculateCurrentStreak(attempts) {
    if (attempts.length === 0) return 0;
    const dates = attempts.map(a => a.attemptedAt).sort((a, b) => b - a);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (const date of dates) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
        if (diff === streak) {
            streak++;
        } else if (diff > streak) {
            break;
        }
    }
    return streak;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}


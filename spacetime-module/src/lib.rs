use spacetimedb::{table, reducer, ReducerContext, Table};
use serde::{Deserialize, Serialize};

// ======== Database Schema ========

#[derive(Serialize, Deserialize, Clone, Debug)]
#[table(name = user, public)]
pub struct User {
    #[primary_key]
    pub user_id: String,
    pub session_id: String,
    pub role: String, // "user" or "admin"
    pub connected_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[table(name = poll, public)]
pub struct Poll {
    #[primary_key]
    pub poll_id: u64,
    pub question: String,
    pub is_active: bool,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[table(name = poll_option, public)]
pub struct PollOption {
    #[primary_key]
    pub option_id: u64,
    pub poll_id: u64,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[table(name = vote, public)]
pub struct Vote {
    #[primary_key]
    pub vote_id: u64,
    pub poll_id: u64,
    pub user_id: String,
    pub option_id: u64,
    pub voted_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[table(name = presentation_state, public)]
pub struct PresentationState {
    #[primary_key]
    pub id: u8, // Just one row with id=0
    pub current_poll_id: u64,
    pub state: String, // "waiting", "voting", "results", "ended"
}

// ======== Reducers (Server-side functions) ========

#[reducer]
pub fn join_session(ctx: &ReducerContext, session_id: String, role: String) -> Result<(), String> {
    // Validate role
    if role != "user" && role != "admin" {
        return Err("Invalid role. Must be 'user' or 'admin'".to_string());
    }
    
    // Create or update user
    let user = User {
        user_id: ctx.sender.to_string(),
        session_id,
        role,
        connected_at: ctx.timestamp.to_micros_since_unix_epoch(),
    };
    
    // Get user table handle
    let user_table = ctx.db.user();
    
    // Check if user exists
    if user_table.user_id().find(&user.user_id).is_some() {
        // Update user
        user_table.user_id().update(user);
    } else {
        // Insert new user
        user_table.insert(user);
    }
    
    // Initialize presentation state if it doesn't exist
    let presentation_table = ctx.db.presentation_state();
    if presentation_table.id().find(&0).is_none() {
        let initial_state = PresentationState {
            id: 0,
            current_poll_id: 0,
            state: "waiting".to_string(),
        };
        presentation_table.insert(initial_state);
    }
    
    Ok(())
}

#[reducer]
pub fn create_poll(ctx: &ReducerContext, question: String, options: Vec<String>) -> Result<(), String> {
    // Check if user is admin
    let user_table = ctx.db.user();
    if let Some(user) = user_table.user_id().find(&ctx.sender.to_string()) {
        if user.role != "admin" {
            return Err("Only admins can create polls".to_string());
        }
    } else {
        return Err("User not found".to_string());
    }
    
    // Generate poll ID
    let poll_table = ctx.db.poll();
    let polls = poll_table.iter().collect::<Vec<_>>();
    let poll_id = (polls.len() + 1) as u64;
    
    // Create poll
    let poll = Poll {
        poll_id,
        question,
        is_active: false, // Not active until explicitly activated
        created_at: ctx.timestamp.to_micros_since_unix_epoch(),
    };
    
    poll_table.insert(poll);
    
    // Create options
    let option_table = ctx.db.poll_option();
    for (i, option_text) in options.iter().enumerate() {
        let option = PollOption {
            option_id: (i + 1) as u64,
            poll_id,
            text: option_text.clone(),
        };
        option_table.insert(option);
    }
    
    // Return success - the poll_id has been stored in the database
    Ok(())
}

#[reducer]
pub fn activate_poll(ctx: &ReducerContext, poll_id: u64) -> Result<(), String> {
    // Check if user is admin
    let user_table = ctx.db.user();
    if let Some(user) = user_table.user_id().find(&ctx.sender.to_string()) {
        if user.role != "admin" {
            return Err("Only admins can activate polls".to_string());
        }
    } else {
        return Err("User not found".to_string());
    }
    
    // Check if poll exists
    let poll_table = ctx.db.poll();
    if let Some(poll) = poll_table.poll_id().find(&poll_id) {
        // Deactivate all other polls
        for p in poll_table.iter() {
            if p.poll_id != poll_id && p.is_active {
                // Update poll to inactive
                let updated_poll = Poll {
                    poll_id: p.poll_id,
                    question: p.question.clone(),
                    is_active: false,
                    created_at: p.created_at,
                };
                poll_table.poll_id().update(updated_poll);
            }
        }
        
        // Activate this poll by updating
        let updated_poll = Poll {
            poll_id,
            question: poll.question.clone(),
            is_active: true,
            created_at: poll.created_at,
        };
        
        poll_table.poll_id().update(updated_poll);
        
        // Update presentation state
        let presentation_table = ctx.db.presentation_state();
        if presentation_table.id().find(&0).is_some() {
            // Update presentation state
            let new_state = PresentationState {
                id: 0,
                current_poll_id: poll_id,
                state: "voting".to_string(),
            };
            
            presentation_table.id().update(new_state);
        }
        
        Ok(())
    } else {
        Err("Poll not found".to_string())
    }
}

#[reducer]
pub fn submit_vote(ctx: &ReducerContext, poll_id: u64, option_id: u64) -> Result<(), String> {
    // Check if user exists
    let user_table = ctx.db.user();
    if user_table.user_id().find(&ctx.sender.to_string()).is_none() {
        return Err("User not found".to_string());
    }
    
    // Check if poll exists and is active
    let poll_table = ctx.db.poll();
    if let Some(poll) = poll_table.poll_id().find(&poll_id) {
        if !poll.is_active {
            return Err("Poll is not active".to_string());
        }
    } else {
        return Err("Poll not found".to_string());
    }
    
    // Check if option exists for this poll
    let option_table = ctx.db.poll_option();
    let option_exists = option_table.iter()
        .any(|o| o.poll_id == poll_id && o.option_id == option_id);
    if !option_exists {
        return Err("Option not found for this poll".to_string());
    }
    
    // Look for existing vote
    let vote_table = ctx.db.vote();
    let user_id = ctx.sender.to_string();
    
    // Find existing vote by filtering through all votes for this user and poll
    let mut existing_vote_id = None;
    for vote in vote_table.iter() {
        if vote.poll_id == poll_id && vote.user_id == user_id {
            existing_vote_id = Some(vote.vote_id);
            break;
        }
    }
    
    if let Some(vote_id) = existing_vote_id {
        // Update existing vote
        let updated_vote = Vote {
            vote_id,
            poll_id,
            user_id,
            option_id,
            voted_at: ctx.timestamp.to_micros_since_unix_epoch(),
        };
        
        vote_table.vote_id().update(updated_vote);
    } else {
        // Create new vote
        let all_votes = vote_table.iter().collect::<Vec<_>>();
        let vote_id = (all_votes.len() + 1) as u64;
        
        let vote = Vote {
            vote_id,
            poll_id,
            user_id,
            option_id,
            voted_at: ctx.timestamp.to_micros_since_unix_epoch(),
        };
        
        vote_table.insert(vote);
    }
    
    Ok(())
}

#[reducer]
pub fn show_results(ctx: &ReducerContext) -> Result<(), String> {
    // Check if user is admin
    let user_table = ctx.db.user();
    if let Some(user) = user_table.user_id().find(&ctx.sender.to_string()) {
        if user.role != "admin" {
            return Err("Only admins can show results".to_string());
        }
    } else {
        return Err("User not found".to_string());
    }
    
    // Update presentation state
    let presentation_table = ctx.db.presentation_state();
    if let Some(old_state) = presentation_table.id().find(&0) {
        let new_state = PresentationState {
            id: 0,
            current_poll_id: old_state.current_poll_id,
            state: "results".to_string(),
        };
        
        presentation_table.id().update(new_state);
        Ok(())
    } else {
        Err("Presentation state not found".to_string())
    }
}

#[reducer]
pub fn end_session(ctx: &ReducerContext) -> Result<(), String> {
    // Check if user is admin
    let user_table = ctx.db.user();
    if let Some(user) = user_table.user_id().find(&ctx.sender.to_string()) {
        if user.role != "admin" {
            return Err("Only admins can end the session".to_string());
        }
    } else {
        return Err("User not found".to_string());
    }
    
    // Update presentation state
    let presentation_table = ctx.db.presentation_state();
    if let Some(old_state) = presentation_table.id().find(&0) {
        let new_state = PresentationState {
            id: 0,
            current_poll_id: old_state.current_poll_id,
            state: "ended".to_string(),
        };
        
        presentation_table.id().update(new_state);
        
        // Deactivate all polls
        let poll_table = ctx.db.poll();
        for poll in poll_table.iter() {
            if poll.is_active {
                // Update poll to inactive
                let updated_poll = Poll {
                    poll_id: poll.poll_id,
                    question: poll.question.clone(),
                    is_active: false,
                    created_at: poll.created_at,
                };
                
                poll_table.poll_id().update(updated_poll);
            }
        }
        
        Ok(())
    } else {
        Err("Presentation state not found".to_string())
    }
}

// ======== Initial Setup ========

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    // Initialize the presentation state
    let initial_state = PresentationState {
        id: 0,
        current_poll_id: 0,
        state: "waiting".to_string(),
    };
    ctx.db.presentation_state().insert(initial_state);
}

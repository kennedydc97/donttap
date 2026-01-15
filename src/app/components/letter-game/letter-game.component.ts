import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { interval, Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';

// Default configuration - all game settings in one place
const DEFAULT_GAME_CONFIG = {
  letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
  letterChangeIntervalMs: 300, // Time between letter changes (milliseconds)
  clickTimerSeconds: 5, // Countdown duration after clicking a letter (seconds)
  cycleCountdownSeconds: 5, // Countdown duration during letter cycling (0 = disabled, seconds)
  showRemovedLetters: true, // Show/hide removed letters display
  showAllLetters: false, // Show all letters in card/circle format
  addTrump: false, // Add "?" (trump) symbol to the game
  randomizeLettersInShowAll: false, // Randomize/shuffle letters in "show all letters" mode
  deathMessage: 'YOU DIED', // Message to show when countdown ends
  deathMessageDurationSeconds: 2 // Duration to show the death message (seconds)
};

interface GameConfig {
  letters: string[];
  letterChangeIntervalMs: number;
  clickTimerSeconds: number;
  cycleCountdownSeconds: number;
  showRemovedLetters: boolean;
  showAllLetters: boolean;
  addTrump: boolean;
  randomizeLettersInShowAll: boolean;
  deathMessage: string;
  deathMessageDurationSeconds: number;
}

interface GamePreset {
  name: string;
  description?: string;
  config: GameConfig;
}

const GAME_PRESETS: GamePreset[] = [
  {
    name: 'Party Mode',
    description: 'Fast swaps, short clicks, high energy.',
    config: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      letterChangeIntervalMs: 200,
      clickTimerSeconds: 3,
      cycleCountdownSeconds: 0,
      showRemovedLetters: false,
      showAllLetters: false,
      addTrump: true,
      randomizeLettersInShowAll: false,
      deathMessage: 'PARTY OVER',
      deathMessageDurationSeconds: 1.5
    }
  },
  {
    name: 'Focus / Reaction Mode',
    description: 'Fewer letters, ultra-fast reactions.',
    config: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
      letterChangeIntervalMs: 140,
      clickTimerSeconds: 2,
      cycleCountdownSeconds: 0,
      showRemovedLetters: true,
      showAllLetters: false,
      addTrump: false,
      randomizeLettersInShowAll: false,
      deathMessage: 'TOO SLOW',
      deathMessageDurationSeconds: 1.5
    }
  },
  {
    name: 'Classroom Mode',
    description: 'All letters visible for group play.',
    config: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      letterChangeIntervalMs: 300,
      clickTimerSeconds: 10,
      cycleCountdownSeconds: 0,
      showRemovedLetters: true,
      showAllLetters: true,
      addTrump: false,
      randomizeLettersInShowAll: false,
      deathMessage: 'TRY AGAIN',
      deathMessageDurationSeconds: 2
    }
  },
  {
    name: 'Elimination Mode',
    description: 'Steady pace, rising pressure.',
    config: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      letterChangeIntervalMs: 280,
      clickTimerSeconds: 4,
      cycleCountdownSeconds: 5,
      showRemovedLetters: true,
      showAllLetters: false,
      addTrump: false,
      randomizeLettersInShowAll: false,
      deathMessage: 'ELIMINATED',
      deathMessageDurationSeconds: 2
    }
  }
];

@Component({
  selector: 'app-letter-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './letter-game.component.html',
  styleUrls: ['./letter-game.component.css']
})
export class LetterGameComponent implements OnInit, OnDestroy {
  // Game configuration (user-configurable)
  gameConfig: GameConfig = { ...DEFAULT_GAME_CONFIG };
  presets: GamePreset[] = GAME_PRESETS;
  readonly buyMeACoffeeUrl: string = 'https://www.buymeacoffee.com/kennedydc';
  
  // Settings UI state
  showSettings: boolean = false;
  lettersInput: string = this.gameConfig.letters.join('');
  letterChangeIntervalMsInput: number = this.gameConfig.letterChangeIntervalMs;
  clickTimerSecondsInput: number = this.gameConfig.clickTimerSeconds;
  cycleCountdownSecondsInput: number = this.gameConfig.cycleCountdownSeconds;
  showRemovedLettersInput: boolean = this.gameConfig.showRemovedLetters;
  showAllLettersInput: boolean = this.gameConfig.showAllLetters;
  addTrumpInput: boolean = this.gameConfig.addTrump;
  randomizeLettersInShowAllInput: boolean = this.gameConfig.randomizeLettersInShowAll;
  deathMessageInput: string = this.gameConfig.deathMessage;
  deathMessageDurationSecondsInput: number = this.gameConfig.deathMessageDurationSeconds;

  // Current state
  currentLetter: string = '';
  availableLetters: string[] = [...this.gameConfig.letters];
  removedLetters: string[] = [];
  isCycling: boolean = true;
  isCountdownActive: boolean = false;
  hasGameStarted: boolean = false;
  countdownValue: number = 0;
  cycleCountdownValue: number = 0;
  isCycleCountdownActive: boolean = false;
  shuffledLettersForDisplay: string[] = []; // Cached shuffled letters for display
  showDeathMessage: boolean = false; // Whether to show the death message

  // Subscriptions
  private letterCycleSubscription?: Subscription;
  private countdownSubscription?: Subscription;
  private cycleCountdownSubscription?: Subscription;
  private deathMessageSubscription?: Subscription;

  ngOnInit(): void {
    // Initialize input values to match current config
    this.syncInputsFromConfig();
    
    this.initializeGame();
  }

  /**
   * Gets the actual letters array including trump if enabled
   */
  private getActualLetters(): string[] {
    const letters = [...this.gameConfig.letters];
    if (this.gameConfig.addTrump && !letters.includes('?')) {
      letters.push('?');
    }
    return letters;
  }

  /**
   * Shuffles an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Gets the actual letters array for display (public method for template)
   */
  getActualLettersForDisplay(): string[] {
    const letters = this.getActualLetters();
    
    // If in "show all letters" mode and randomize is enabled, return shuffled version
    if (this.gameConfig.showAllLetters && this.gameConfig.randomizeLettersInShowAll) {
      // Use cached shuffled letters (generated on initialization/restart)
      // If cache is empty (shouldn't happen, but safety check), generate it
      if (this.shuffledLettersForDisplay.length === 0) {
        this.shuffledLettersForDisplay = this.shuffleArray(letters);
      }
      return this.shuffledLettersForDisplay;
    }
    
    // Otherwise return letters in their original order
    return letters;
  }

  /**
   * Initializes the game with current configuration
   */
  private initializeGame(): void {
    this.availableLetters = this.getActualLetters();
    this.removedLetters = [];
    // Reset shuffled letters cache to force reshuffle if needed
    this.shuffledLettersForDisplay = [];
    this.hasGameStarted = false;
    // Set an initial letter before starting the cycle (only in single letter mode)
    if (!this.gameConfig.showAllLetters && this.availableLetters.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.availableLetters.length);
      this.currentLetter = this.availableLetters[randomIndex];
    } else {
      this.currentLetter = '';
    }
    this.startLetterCycling();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Starts the automatic letter cycling
   */
  private startLetterCycling(): void {
    // Clean up any existing subscription
    if (this.letterCycleSubscription) {
      this.letterCycleSubscription.unsubscribe();
    }

    if (this.availableLetters.length === 0) {
      this.currentLetter = '';
      return;
    }

    this.isCycling = !this.gameConfig.showAllLetters;

    // Start cycle countdown only when cycling is active
    if (this.isCycling && this.gameConfig.cycleCountdownSeconds > 0) {
      this.startCycleCountdown();
    } else {
      this.resetCycleCountdown();
    }

    // Only cycle letters if not in "show all letters" mode
    if (!this.gameConfig.showAllLetters) {
      // Use RxJS interval for letter cycling
      this.letterCycleSubscription = interval(this.gameConfig.letterChangeIntervalMs)
        .subscribe(() => {
          if (this.isCycling && this.availableLetters.length > 0) {
            // Randomly select next letter from available letters
            const randomIndex = Math.floor(Math.random() * this.availableLetters.length);
            this.currentLetter = this.availableLetters[randomIndex];
          }
        });
    } else {
      // In "show all letters" mode, no cycling - set to empty or first available
      this.currentLetter = '';
    }
  }

  /**
   * Starts the cycle countdown timer (doesn't remove letters, just visual)
   */
  private startCycleCountdown(): void {
    // Clean up any existing cycle countdown subscription
    if (this.cycleCountdownSubscription) {
      this.cycleCountdownSubscription.unsubscribe();
    }

    this.isCycleCountdownActive = true;
    this.cycleCountdownValue = this.gameConfig.cycleCountdownSeconds;

    // Use RxJS timer for cycle countdown (emits every second)
    this.cycleCountdownSubscription = timer(0, 1000)
      .pipe(take(this.gameConfig.cycleCountdownSeconds + 1))
      .subscribe((elapsed) => {
        this.cycleCountdownValue = this.gameConfig.cycleCountdownSeconds - elapsed;

        if (this.cycleCountdownValue <= 0) {
          // Cycle countdown reached 0 - restart it if still cycling
          this.resetCycleCountdown();
          if (this.isCycling && this.gameConfig.cycleCountdownSeconds > 0) {
            this.startCycleCountdown();
          }
        }
      });
  }

  /**
   * Resets the cycle countdown timer
   */
  private resetCycleCountdown(): void {
    this.isCycleCountdownActive = false;
    this.cycleCountdownValue = 0;

    if (this.cycleCountdownSubscription) {
      this.cycleCountdownSubscription.unsubscribe();
      this.cycleCountdownSubscription = undefined;
    }
  }

  /**
   * Handles letter click/tap
   */
  onLetterClick(): void {
    if (this.gameConfig.showAllLetters) {
      return;
    }

    if (!this.hasGameStarted) {
      // First click - stop cycling and start countdown
      this.hasGameStarted = true;
      this.stopCycling();
      this.startCountdown();
      return;
    }

    if (this.isCycling) {
      // Click during cycling - freeze on current letter, keep countdown running
      this.stopCycling();
      this.ensureCountdownRunning();
      return;
    }

    if (this.isCountdownActive) {
      // Click during countdown - remove letter and resume cycling
      this.removeCurrentLetter();

      // If no letters remain after removal, reset the game
      if (this.availableLetters.length === 0) {
        this.restartGame();
      } else {
        this.resumeCycling();
        this.restartCountdown();
      }
    } else {
      // Safety: if countdown somehow isn't active, start it
      this.startCountdown();
    }
  }

  /**
   * Stops letter cycling
   */
  private stopCycling(): void {
    this.isCycling = false;
    this.resetCycleCountdown();
  }

  /**
   * Resumes letter cycling
   */
  private resumeCycling(): void {
    this.startLetterCycling();
  }

  /**
   * Starts the countdown timer
   */
  private startCountdown(): void {
    this.isCountdownActive = true;
    this.countdownValue = this.gameConfig.clickTimerSeconds;

    // Clean up any existing countdown subscription
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }

    // Use RxJS timer for countdown (emits every second)
    this.countdownSubscription = timer(0, 1000)
      .pipe(take(this.gameConfig.clickTimerSeconds + 1))
      .subscribe((elapsed) => {
        this.countdownValue = this.gameConfig.clickTimerSeconds - elapsed;

        if (this.countdownValue <= 0) {
          this.handleCountdownExpired();
        }
      });
  }

  /**
   * Ensures the countdown is running after the game has started
   */
  private ensureCountdownRunning(): void {
    if (this.hasGameStarted && !this.isCountdownActive) {
      this.startCountdown();
    }
  }

  /**
   * Restarts the countdown timer
   */
  private restartCountdown(): void {
    this.resetCountdown();
    this.startCountdown();
  }

  /**
   * Handles countdown reaching 0
   */
  private handleCountdownExpired(): void {
    // Only remove letters on countdown expiry in single-letter mode
    if (!this.gameConfig.showAllLetters) {
      this.removeCurrentLetter();
    }

    this.showDeathMessageForDuration();

    // If no letters remain after removal, reset the game
    if (this.availableLetters.length === 0) {
      this.restartGame();
      return;
    }

    if (!this.gameConfig.showAllLetters) {
      // Resume cycling in normal mode
      this.resumeCycling();
    }

    // Countdown continues running after reaching 0
    this.restartCountdown();
  }

  /**
   * Resets the countdown timer
   */
  private resetCountdown(): void {
    this.isCountdownActive = false;
    this.countdownValue = 0;

    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = undefined;
    }
  }

  /**
   * Removes the current letter from the available letters list
   */
  private removeCurrentLetter(): void {
    const index = this.availableLetters.indexOf(this.currentLetter);
    if (index > -1) {
      this.availableLetters.splice(index, 1);
      // Add to removed letters list if not already there
      if (!this.removedLetters.includes(this.currentLetter)) {
        this.removedLetters.push(this.currentLetter);
        // Sort removed letters for better display
        this.removedLetters.sort();
      }
    }
  }

  /**
   * Shows the death message for the configured duration
   */
  private showDeathMessageForDuration(): void {
    // Clean up any existing death message subscription
    if (this.deathMessageSubscription) {
      this.deathMessageSubscription.unsubscribe();
    }

    // Show the message
    this.showDeathMessage = true;

    // Hide the message after the configured duration
    this.deathMessageSubscription = timer(this.gameConfig.deathMessageDurationSeconds * 1000)
      .subscribe(() => {
        this.showDeathMessage = false;
        this.deathMessageSubscription = undefined;
      });
  }

  /**
   * Checks if a letter is removed
   */
  isLetterRemoved(letter: string): boolean {
    return this.removedLetters.includes(letter);
  }

  /**
   * Handles letter card click in "show all letters" mode
   */
  onLetterCardClick(letter: string): void {
    // In "show all letters" mode, any non-removed letter can be clicked
    if (!this.isLetterRemoved(letter)) {
      // Set current letter and handle the click
      this.currentLetter = letter;
      if (!this.hasGameStarted) {
        this.hasGameStarted = true;
      }

      this.removeCurrentLetter();

      if (this.availableLetters.length === 0) {
        this.restartGame();
        return;
      }

      this.restartCountdown();
    }
  }

  /**
   * Restarts the game to initial state
   */
  restartGame(): void {
    this.cleanup();
    this.availableLetters = this.getActualLetters();
    this.removedLetters = [];
    this.currentLetter = '';
    this.isCycling = !this.gameConfig.showAllLetters;
    this.isCountdownActive = false;
    this.hasGameStarted = false;
    this.countdownValue = 0;
    this.isCycleCountdownActive = false;
    this.cycleCountdownValue = 0;
    this.showDeathMessage = false;
    // Reset shuffled letters cache to generate new shuffle on next display
    this.shuffledLettersForDisplay = [];
    this.startLetterCycling();
  }

  /**
   * Toggles the settings panel
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
    if (this.showSettings) {
      // Update input values to current config when opening
      this.syncInputsFromConfig();
    }
  }

  /**
   * Saves the configuration and applies it to the game
   */
  saveConfig(): void {
    // Parse letters from input string (remove non-letter characters, convert to uppercase, unique)
    const parsedLetters = this.lettersInput
      .toUpperCase()
      .split('')
      .filter(char => /[A-Z]/.test(char))
      .filter((char, index, arr) => arr.indexOf(char) === index); // Remove duplicates

    if (parsedLetters.length === 0) {
      alert('Please enter at least one letter (A-Z)');
      return;
    }

    // Validate numeric inputs
    if (this.letterChangeIntervalMsInput < 10 || this.letterChangeIntervalMsInput > 5000) {
      alert('Letter change interval must be between 10 and 5000 milliseconds');
      return;
    }

    if (this.clickTimerSecondsInput < 1 || this.clickTimerSecondsInput > 60) {
      alert('Click timer must be between 1 and 60 seconds');
      return;
    }

    if (this.cycleCountdownSecondsInput < 0 || this.cycleCountdownSecondsInput > 60) {
      alert('Cycle countdown must be between 0 (disabled) and 60 seconds');
      return;
    }

    // Update configuration
    this.gameConfig.letters = parsedLetters;
    this.gameConfig.letterChangeIntervalMs = this.letterChangeIntervalMsInput;
    this.gameConfig.clickTimerSeconds = this.clickTimerSecondsInput;
    this.gameConfig.cycleCountdownSeconds = this.cycleCountdownSecondsInput;
    this.gameConfig.showRemovedLetters = this.showRemovedLettersInput;
    this.gameConfig.showAllLetters = this.showAllLettersInput;
    this.gameConfig.addTrump = this.addTrumpInput;
    this.gameConfig.randomizeLettersInShowAll = this.randomizeLettersInShowAllInput;

    // Restart game with new configuration
    this.restartGame();
    
    // Close settings
    this.showSettings = false;
  }

  /**
   * Resets configuration to defaults
   */
  resetToDefaults(): void {
    this.gameConfig = { ...DEFAULT_GAME_CONFIG };
    this.syncInputsFromConfig();
    this.restartGame();
  }

  /**
   * Applies a preset configuration instantly
   */
  applyPreset(preset: GamePreset): void {
    this.gameConfig = {
      ...preset.config,
      letters: [...preset.config.letters]
    };
    this.syncInputsFromConfig();
    this.restartGame();
  }

  /**
   * Syncs form inputs with current configuration
   */
  private syncInputsFromConfig(): void {
    this.lettersInput = this.gameConfig.letters.join('');
    this.letterChangeIntervalMsInput = this.gameConfig.letterChangeIntervalMs;
    this.clickTimerSecondsInput = this.gameConfig.clickTimerSeconds;
    this.cycleCountdownSecondsInput = this.gameConfig.cycleCountdownSeconds;
    this.showRemovedLettersInput = this.gameConfig.showRemovedLetters;
    this.showAllLettersInput = this.gameConfig.showAllLetters;
    this.addTrumpInput = this.gameConfig.addTrump;
    this.randomizeLettersInShowAllInput = this.gameConfig.randomizeLettersInShowAll;
    this.deathMessageInput = this.gameConfig.deathMessage;
    this.deathMessageDurationSecondsInput = this.gameConfig.deathMessageDurationSeconds;
  }

  /**
   * Cleans up all subscriptions
   */
  private cleanup(): void {
    if (this.letterCycleSubscription) {
      this.letterCycleSubscription.unsubscribe();
      this.letterCycleSubscription = undefined;
    }

    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = undefined;
    }

    if (this.cycleCountdownSubscription) {
      this.cycleCountdownSubscription.unsubscribe();
      this.cycleCountdownSubscription = undefined;
    }

    if (this.deathMessageSubscription) {
      this.deathMessageSubscription.unsubscribe();
      this.deathMessageSubscription = undefined;
    }
  }
}


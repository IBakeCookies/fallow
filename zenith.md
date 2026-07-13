# Zenith Gradient Algorithm — source article (historical reference)

> **STATUS: historical reference — do not implement from this file.**
> This is a frozen copy of the source article the project began from, kept so
> the original math survives even if the article goes offline (its figures were
> images and are missing here anyway). The implemented model has since deviated
> from it deliberately — new productivity curve, per-task optimal stopping,
> discrete allocator, Bayesian fit. **[MATH.md](MATH.md) is the authoritative
> description of what the code does**, including a table of every deviation
> from this article and why (MATH.md §6). If code disagrees with this article,
> that is intentional.

## URL

<https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e>

## Motivation

Let’s say, for example, you have 4 tasks to do in a given day: Work on an essay, do some math homework, edit a video, and study for a physics exam, and let’s also assume that you have 6 hours in total to spend on all these tasks. The question is: how should you best allocate time to each one of these tasks to maximize your productivity? A rudimentary approach would be to allocate time arbitrarily or allocate an equal amount of time to each task without taking into account any factors like the difficulty of the task etc. In this case, you could simply allocate 1.5 hours to each task and call it a day, but could you do better? What if you instead allocated 1 hour for working on the essay, 0.5 hours for the math homework, 2.5 hours for editing the video and 2 hours for studying physics? You would still spend a total of 6 hours, but would this be better? i.e., Would you be more productive? How can we quantify these decisions? How could we build a todo app that does this computation for us?

Defining Productivity
For a given task, let ρ(t) be the amount of progress we have made at time t, then productivity p(t) can be defined as the amount of progress made per unit time, i.e. p(t) = dρ/dt (Productivity is the time derivative of progress). If we make a lot of progress really quickly, then we are more productive, if our progress doesn’t change with respect to time, then we aren’t productive at all, so this is a reasonable definition for productivity.

Finding a Model
While doing a task, productivity as a function of time naturally has the shape of a Poisson Distribution, it starts at some initial value, then increases to some maximum point (this can be the mathematical definition of flow state, i.e., flow state can be defined as a time when we’re most productive), then decreases as we lose energy. A good model for this type of behavior is the function

Press enter or click to view image in full size

desmos graph
This curve can be parameterized by the effort of the task E, the enjoyability of the task β, and the time it takes to reach flow state ϕ. As mentioned above, flow state can be defined as the time when productivity reaches a maximum. To calculate this value, we can set dp/dt = 0 and solve for t. This calculation results in t=1/k. We can now set this value of t equal to ϕ and solve for k, which results in k=1/ϕ.

We can express ϕ as a function of E and β

Press enter or click to view image in full size

Pinpointing this function exactly would be complicated. Instead, we can approximate ϕ as a linear function:

Press enter or click to view image in full size

where c₁, c₂ and c₃ are constants that vary from person to person and are within a range such that ϕ>0.

The initial productivity p₀ can be defined

Press enter or click to view image in full size

we typically have a harder time starting higher effort tasks compared to lower effort tasks and hence our starting productivity decreases as the effort of the task increases, we also tend to have an easier time starting tasks that we really enjoy, so our starting productivity increases as the enjoyability increases.

Increasing the parameter ‘a’ increases the global maximum of the function and hence increases the value of our peak productivity. We can try to quantify how ‘a’ depends on the parameters E and β by thinking of how our peak productivity (flow state) changes depending on the effort of the task and how much we enjoy doing it.

Let’s use a video game as an example, when playing a low effort video game, the flow state we experience won’t feel that much different than how we feel on a regular basis, in contrast when playing a high effort competitive video game, the flow state we experience will feel almost magical compared to any other time, especially if we really enjoy the game.

This tells us that higher effort tasks that we really enjoy correspond to a higher peak productivity. A good model for this is the function

Press enter or click to view image in full size

Putting this all together we have

Press enter or click to view image in full size

Defining The Parameter Boundaries
In the previous section we defined the time it takes to reach flow state ϕ as

Press enter or click to view image in full size

where c₁, c₂ and c₃ are constants that vary from person to person. For ϕ to be non negative, we can define a fixed range for E and β. We can define some intermediate variables Eᵤ and βᵤ to be the effort and the enjoyability respectively that the user provides. For consistency, both of these values will range from 1 to 10 and will then be mapped linearly to their respective ranges, i.e., E (the true value of effort) is a linear function of Eᵤ and β (the true value of enjoyability) is a linear function of βᵤ.

The Boundary of Effort
Experimentally, it was determined that a good range for E is 1≤E≤5, we can now linearly map the range of Eᵤ (the intermediate value of effort) from 1 to 10 down to 1 to 5 using the function

Press enter or click to view image in full size

The Boundary of Enjoyability
Similarly, a good range for β is 1≤β≤2, we can linearly map the range of βᵤ from 1 to 10 down to 1 to 2 using the function

Press enter or click to view image in full size

User Dependent Constants
Now we will explore how c₁, c₂ and c₃ can be determined.

For each task (Task i), a stopwatch can be used to measure the time until flow state ϕ (the time it takes to get in the “zone”). This will give us data points

Press enter or click to view image in full size

where Eᵢ is the effort of task i and βᵢ is the enjoyability of task i.

Write on Medium
We can then use Linear Least Squares approximation to find the best fit plane to the data, which results in

NB: c₁, c₂ and c₃ will be updated after a new data point has been provided.

When to Stop Doing a Task
Let’s assume you have the task of studying for a math exam, and you’ve determined that the effort of this task on a scale from 1 to 10 is about 7 (Eᵤ=7 → E=3.67), the enjoyability is 3 (βᵤ=3 → β=1.22). Let’s also assume that your user dependent constants are c₁=0.56, c₂=−0.24, and c₃=0 your estimated time until flow state will then be

Press enter or click to view image in full size

and your productivity curve is

Press enter or click to view image in full size

Now the question is, how long should you spend doing this task to maximize productivity? If you study for too long, you will become burnt out and start experiencing diminishing returns, study for too little, and you risk not getting enough value out of that session. There is a sweet spot, and intuitively, we know it lies some time after you reach flow state… but how long after? To answer this, we need a measure of how productive you are on some time interval, for the sake of example, let’s say the first 30 minutes into studying. A good measure for this is the average of p(t) between t=0 and t=0.50, which can be calculated by:

Press enter or click to view image in full size

We can compare this to a later time interval, let’s say between 8 and 8 and a half hours.

Press enter or click to view image in full size

As we can see, the first 30 minutes into studying was much more valuable than 30 minutes a couple of hours later. Now, we can define

Press enter or click to view image in full size

We can finally find the global maximum of this function to get the optimal time you should spend studying to maximize productivity

Solving for t numerically, we find that t ≈ 3.16. So the optimal amount of time you should spend studying is 3 hours and 10 minutes.

Press enter or click to view image in full size

Generalizing
If we have n tasks to complete in T hours and are given

Press enter or click to view image in full size

the effort vector, and

Press enter or click to view image in full size

the enjoyability vector where Eᵢ is effort of task i, and βᵢ is the enjoyability of task i.

We can define

Let P(t) be the total productivity for the day, where t = ⟨t₁, t₂,… tₙ⟩, and tᵢ is the time spent doing task i. P(t) can be defined as the sum of the average productivity for each task.

We can now maximize this function under the constraint that

using the method of Lagrange multipliers.

Press enter or click to view image in full size

Solving The System of Equations
Let us revisit the example that we started with: “You have 4 tasks to do in a given day: Work on an essay (Task 1), do some math homework (Task 2), edit a video (Task 3), study for a physics exam (Task 4), and let’s also assume that you have 6 hours in total to spend on all these tasks. The question is, how should you best allocate time to each one of these task to maximize productivity?” Each of these tasks have an associated effort and enjoyability, we can define:

Press enter or click to view image in full size

Therefore,

Press enter or click to view image in full size

Solving this system numerically results in the solution:

So, to maximize your productivity for the day, you should spend 0.70 hours (42 minutes) working on the essay, 1.84 hours (1 hour and 50 minutes) doing the Math homework, 1.11 hours (1 hour and 7 minutes) editing the video and 2.31 hours (2 hours and 21 minutes) studying physics.

We can now compare this to the rudimentary approach mentioned at the beginning, where you would arbitrarily allocate time. For example, let’s say you allocated 2.5 hours for the essay, 2 hours for math, 0.5 hours for editing the video, and 1 hour for studying physics.

P(2.5, 2, 0.5, 1) ≈ 5.16, while P(0.70, 1.84, 1.11, 2.35) ≈ 6.13 which means you would increase your productivity for the day by about 19% by using this model.

Sanity Check
If we have a list of tasks to complete that all have the same level of effort and enjoyment, intuitively we would expect that it would be best to spend an equal amount of time on each task since there would be no reason to prioritize one task over another. Mathematically, this states that if we solve the non-linear system above with

where

Press enter or click to view image in full size

for some value of E and β, then the solution to the system will be

The proof of this is left as an exercise for the reader :)
